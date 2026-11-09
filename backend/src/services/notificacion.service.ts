import { prisma, Tx } from "../repositories/prisma";
import { enviarCorreo } from "./correo.service";
import { construirCorreo, TipoNotificacion, DatosCorreo } from "./plantillasCorreo";

type Db = typeof prisma | Tx;

const MAX_INTENTOS = 8;

/**
 * Encola una notificación en el outbox persistente. Debe llamarse dentro de la
 * misma transacción que el cambio de negocio que la origina.
 */
export async function encolar(
  db: Db,
  params: {
    tipo: TipoNotificacion;
    destinatario: string;
    datos: DatosCorreo;
    dedupKey?: string;
    programadaPara?: Date;
  }
) {
  const { asunto, html, adjuntosMeta } = construirCorreo(params.tipo, params.datos);
  try {
    return await db.notificacion.create({
      data: {
        tipo: params.tipo,
        destinatario: params.destinatario,
        asunto,
        payload: { html, adjuntosMeta, datos: params.datos } as object,
        dedupKey: params.dedupKey ?? null,
        programadaPara: params.programadaPara ?? new Date(),
      },
    });
  } catch (e) {
    // dedupKey duplicada → la notificación ya existe; es un no-op intencional
    if (params.dedupKey && (e as { code?: string }).code === "P2002") return null;
    throw e;
  }
}

/**
 * Procesa las notificaciones pendientes cuya programación ya venció.
 * Devuelve el número procesado. Los fallos se reintentan con backoff.
 */
export async function procesarOutbox(limite = 20): Promise<number> {
  const pendientes = await prisma.notificacion.findMany({
    where: {
      estado: { in: ["PENDIENTE", "FALLIDA"] },
      programadaPara: { lte: new Date() },
      intentos: { lt: MAX_INTENTOS },
    },
    orderBy: { programadaPara: "asc" },
    take: limite,
  });

  let procesadas = 0;
  for (const n of pendientes) {
    // Reclamo optimista: solo una instancia del job procesa esta fila
    const reclamo = await prisma.notificacion.updateMany({
      where: { id: n.id, estado: n.estado, intentos: n.intentos },
      data: { intentos: { increment: 1 } },
    });
    if (reclamo.count === 0) continue;

    try {
      const payload = n.payload as { html: string; adjuntosMeta?: { filename: string; contentBase64: string; cid?: string }[] };
      await enviarCorreo({
        para: n.destinatario,
        asunto: n.asunto,
        html: payload.html,
        adjuntos: payload.adjuntosMeta?.map(a => ({
          filename: a.filename,
          content: Buffer.from(a.contentBase64, "base64"),
          cid: a.cid,
        })),
      });
      await prisma.notificacion.update({
        where: { id: n.id },
        data: { estado: "ENVIADA", enviadaAt: new Date(), ultimoError: null },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const agotado = n.intentos + 1 >= MAX_INTENTOS;
      await prisma.notificacion.update({
        where: { id: n.id },
        data: {
          estado: agotado ? "FALLIDA" : "PENDIENTE",
          ultimoError: msg.slice(0, 500),
          // backoff exponencial simple: 2^intentos minutos
          programadaPara: new Date(Date.now() + Math.pow(2, n.intentos + 1) * 60_000),
        },
      });
    }
    procesadas++;
  }
  return procesadas;
}
