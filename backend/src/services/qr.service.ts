import QRCode from "qrcode";
import { prisma, Tx } from "../repositories/prisma";
import { DateTime } from "luxon";
import { env } from "../config/env";
import { aBogota } from "../utils/tiempo";
import { generarToken, hashToken, cifrarToken, descifrarToken } from "../utils/tokens";
import { badRequest, forbidden, notFound } from "../utils/errors";
import { obtenerConfigNum } from "./configuracion.service";
import { enviarCorreo } from "./correo.service";
import { construirCorreo } from "./plantillasCorreo";

type Db = typeof prisma | Tx;

export function enlaceAsistencia(token: string): string {
  return `${env.publicAppUrl}/asistencia/${token}`;
}

/**
 * Crea el RegistroQrFormacion de una reserva recién confirmada, dentro de la
 * misma transacción. El envío del correo queda programado a inicio + 30 min
 * (configurable vía `qr_envio_minutos`); el QR se genera ahora pero no se
 * distribuye hasta que el job lo envíe.
 */
export async function programarQrPara(tx: Tx, reservaId: string) {
  const reserva = await tx.reserva.findUniqueOrThrow({ where: { id: reservaId } });
  const inicio = aBogota(reserva.iniciaAt);
  const fin = aBogota(reserva.terminaAt);
  const envioMin = await obtenerConfigNum("qr_envio_minutos");
  const cierreMin = await obtenerConfigNum("asistencia_cierre_minutos");
  const envioProgramado = inicio.plus({ minutes: envioMin });

  const token = generarToken();
  await tx.registroQrFormacion.upsert({
    where: { reservaId },
    create: {
      reservaId,
      tokenHash: hashToken(token),
      tokenCifrado: cifrarToken(token),
      estado: "PROGRAMADO",
      estadoEnvio: "PENDIENTE",
      // El registro queda habilitado desde el mismo momento del envío del QR
      fechaHabilitacion: envioProgramado.toJSDate(),
      fechaCierre: fin.plus({ minutes: cierreMin }).toJSDate(),
      fechaEnvioProgramado: envioProgramado.toJSDate(),
    },
    update: {
      estado: "PROGRAMADO",
      estadoEnvio: "PENDIENTE",
      fechaHabilitacion: envioProgramado.toJSDate(),
      fechaCierre: fin.plus({ minutes: cierreMin }).toJSDate(),
      fechaEnvioProgramado: envioProgramado.toJSDate(),
      ultimoError: null,
    },
  });
}

/**
 * Recalcula la programación del QR cuando cambia la fecha/hora de la reserva
 * (p. ej. tras una propuesta de nueva fecha aceptada).
 */
export async function reprogramarQrPara(tx: Tx, reservaId: string) {
  await programarQrPara(tx, reservaId);
}

/**
 * Job persistente: procesa los envíos de QR vencidos. Sobrevive reinicios
 * porque el estado vive en la base de datos. Si la reserva fue reasignada, el
 * destinatario se resuelve al momento del envío (formador vigente).
 */
export async function procesarEnviosQr(limite = 10): Promise<number> {
  const ahora = new Date();
  const pendientes = await prisma.registroQrFormacion.findMany({
    where: { estadoEnvio: "PENDIENTE", fechaEnvioProgramado: { lte: ahora } },
    orderBy: { fechaEnvioProgramado: "asc" },
    take: limite,
  });

  let procesados = 0;

  for (const qr of pendientes) {
    // Reclamo optimista para que solo un worker lo procese
    const reclamo = await prisma.registroQrFormacion.updateMany({
      where: { id: qr.id, estadoEnvio: "PENDIENTE", intentosEnvio: qr.intentosEnvio },
      data: { intentosEnvio: { increment: 1 } },
    });
    if (reclamo.count === 0) continue;

    try {
      const reserva = await prisma.reserva.findUnique({
        where: { id: qr.reservaId },
        include: { curso: true, formador: { include: { cuenta: true } } },
      });
      if (!reserva || reserva.estado === "CANCELADA") {
        await prisma.registroQrFormacion.update({
          where: { id: qr.id },
          data: { estadoEnvio: "OMITIDO", estado: "INVALIDADO", ultimoError: "Reserva cancelada" },
        });
        continue;
      }
      // Si la ventana de registro ya cerró (fin del curso + margen) no tiene
      // sentido enviar el QR; una formación FINALIZADA con ventana abierta
      // aún lo recibe.
      if (aBogota(qr.fechaCierre) < DateTime.now()) {
        await prisma.registroQrFormacion.update({
          where: { id: qr.id },
          data: {
            estadoEnvio: "INCIDENCIA",
            ultimoError: "La ventana de registro ya había cerrado al procesar el envío",
          },
        });
        continue;
      }

      // Destinatario = formador vigente (cubre reasignaciones)
      const destinatario = reserva.formador.cuenta.correo;
      const token = descifrarToken(qr.tokenCifrado);
      const enlace = enlaceAsistencia(token);
      const png = await QRCode.toBuffer(enlace, { width: 320, margin: 1 });

      const inicio = aBogota(reserva.iniciaAt);
      const { asunto, html } = construirCorreo("QR_ASISTENCIA", {
        nombreDestinatario: reserva.formador.cuenta.nombreCompleto,
        curso: reserva.curso.nombre,
        fecha: inicio.toFormat("dd/MM/yyyy"),
        horaInicio: inicio.toFormat("HH:mm"),
        horaFin: aBogota(reserva.terminaAt).toFormat("HH:mm"),
        codigoReserva: reserva.codigo,
        enlaceAccion: enlace,
        qrPngBase64: png.toString("base64"),
        extra: { cierre: aBogota(qr.fechaCierre).toFormat("dd/MM/yyyy HH:mm") },
      });
      await enviarCorreo({
        para: destinatario,
        asunto,
        html,
        adjuntos: [{ filename: "qr-asistencia.png", content: png, cid: "qr-asistencia" }],
      });

      await prisma.registroQrFormacion.update({
        where: { id: qr.id },
        data: {
          estadoEnvio: "ENVIADO",
          estado: "ABIERTO",
          fechaEnvioReal: new Date(),
          destinatario,
          ultimoError: null,
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // El QR debe enviarse sí o sí: reintenta con backoff (tope 60 min)
      // mientras la ventana de registro siga abierta; vencida → INCIDENCIA.
      const vencida = aBogota(qr.fechaCierre) < DateTime.now();
      await prisma.registroQrFormacion.update({
        where: { id: qr.id },
        data: {
          estadoEnvio: vencida ? "INCIDENCIA" : "PENDIENTE",
          ultimoError: msg.slice(0, 500),
          fechaEnvioProgramado: vencida
            ? qr.fechaEnvioProgramado
            : new Date(Date.now() + Math.min(Math.pow(2, qr.intentosEnvio + 1), 60) * 60_000),
        },
      });
    }
    procesados++;
  }
  return procesados;
}

export type EstadoFormularioQr =
  | { ok: true; reservaId: string; curso: string; fecha: string; horaInicio: string; horaFin: string; codigo: string; yaRespondio?: boolean }
  | { ok: false; motivo: string };

async function registrarIntentoInvalido(reservaId: string | null, motivo: string, ip?: string) {
  await prisma.registroIntentoQr.create({ data: { reservaId, motivo, ip: ip ?? null } });
}

/**
 * Valida el token del QR escaneado y devuelve los datos mínimos del formulario,
 * o el motivo por el que el registro está cerrado/inválido.
 */
export async function resolverTokenQr(token: string, ip?: string): Promise<EstadoFormularioQr> {
  const qr = await prisma.registroQrFormacion.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { reserva: { include: { curso: true } } },
  });
  const ahora = DateTime.now();

  if (!qr) {
    await registrarIntentoInvalido(null, "TOKEN_DESCONOCIDO", ip);
    throw notFound("Enlace de asistencia inválido");
  }
  const r = qr.reserva;
  const motivoInvalido = async (m: string): Promise<never> => {
    await registrarIntentoInvalido(r.id, m, ip);
    throw badRequest(m);
  };

  if (qr.estado === "INVALIDADO" || r.estado === "CANCELADA") {
    return motivoInvalido("La formación fue cancelada");
  }
  if (ahora < aBogota(qr.fechaHabilitacion)) {
    return motivoInvalido("El registro de asistencia aún no está habilitado");
  }
  // El QR sigue funcionando hasta fechaCierre (= fin del curso + margen
  // configurado), aunque la reserva ya haya pasado a FINALIZADA.
  if (qr.estado === "CERRADO" || ahora > aBogota(qr.fechaCierre)) {
    return motivoInvalido("El registro de asistencia está cerrado");
  }
  const ini = aBogota(r.iniciaAt);
  return {
    ok: true,
    reservaId: r.id,
    curso: r.curso.nombre,
    fecha: ini.toFormat("dd/MM/yyyy"),
    horaInicio: ini.toFormat("HH:mm"),
    horaFin: aBogota(r.terminaAt).toFormat("HH:mm"),
    codigo: r.codigo,
  };
}

/** Cierra manualmente el registro (administración o formador con permiso). */
export async function cerrarRegistro(reservaId: string) {
  await prisma.registroQrFormacion.updateMany({
    where: { reservaId },
    data: { estado: "CERRADO" },
  });
}

/** Reabre el registro hasta su fecha de cierre programada. */
export async function abrirRegistro(reservaId: string) {
  await prisma.registroQrFormacion.updateMany({
    where: { reservaId },
    data: { estado: "ABIERTO" },
  });
}

/** Estado del QR para el panel del formador / administración. */
export async function estadoQrReserva(reservaId: string) {
  const qr = await prisma.registroQrFormacion.findUnique({ where: { reservaId } });
  if (!qr) return null;
  const asistencias = await prisma.asistencia.count({ where: { reservaId } });
  const evaluaciones = await prisma.evaluacionFormacion.count({ where: { reservaId } });
  return {
    estado: qr.estado,
    estadoEnvio: qr.estadoEnvio,
    fechaEnvioProgramado: qr.fechaEnvioProgramado,
    fechaEnvioReal: qr.fechaEnvioReal,
    fechaHabilitacion: qr.fechaHabilitacion,
    fechaCierre: qr.fechaCierre,
    destinatario: qr.destinatario,
    ultimoError: qr.ultimoError,
    asistencias,
    evaluaciones,
  };
}
