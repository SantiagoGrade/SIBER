import { prisma } from "../repositories/prisma";
import { DateTime } from "luxon";
import { aBogota, ahora } from "../utils/tiempo";
import { encolar } from "./notificacion.service";
import { obtenerConfigNum } from "./configuracion.service";
import { DatosCorreo, TipoNotificacion } from "./plantillasCorreo";

type ReservaConDetalle = Awaited<ReturnType<typeof buscarReservasDeManana>>[number];

function fmt(d: DateTime) { return d.toFormat("dd/MM/yyyy"); }
function fmtHora(d: DateTime) { return d.toFormat("HH:mm"); }

async function buscarReservasDeManana(manana: DateTime, finManana: DateTime) {
  return prisma.reserva.findMany({
    where: {
      estado: "CONFIRMADA",
      iniciaAt: { gte: manana.toJSDate(), lt: finManana.toJSDate() },
    },
    include: { curso: true, formador: { include: { cuenta: true } } },
    orderBy: { iniciaAt: "asc" },
  });
}

/**
 * Devuelve los códigos de reserva ya incluidos en recordatorios previos del
 * mismo destinatario y fecha (dedup `base`, `base:1`, `base:2`, …). Permite
 * que una reserva incorporada tarde al día de mañana (p. ej. por una
 * reasignación) reciba su propio correo sin repetir las ya recordadas.
 */
async function reservasYaRecordadas(dedupBase: string): Promise<Set<string>> {
  const previas = await prisma.notificacion.findMany({
    where: { dedupKey: { startsWith: dedupBase } },
    select: { payload: true },
  });
  const cubiertos = new Set<string>();
  for (const n of previas) {
    const items = (n.payload as { datos?: { items?: { codigoReserva?: string }[] } })?.datos?.items;
    if (Array.isArray(items)) {
      for (const it of items) if (it.codigoReserva) cubiertos.add(it.codigoReserva);
    }
  }
  return cubiertos;
}

async function encolarGrupo(params: {
  tipo: TipoNotificacion;
  destinatario: string;
  nombreDestinatario: string;
  dedupBase: string;
  fecha: string;
  reservas: ReservaConDetalle[];
  itemDe: (r: ReservaConDetalle) => DatosCorreo;
}): Promise<boolean> {
  const cubiertos = await reservasYaRecordadas(params.dedupBase);
  const pendientes = params.reservas.filter(r => !cubiertos.has(r.codigo));
  if (!pendientes.length) return false;

  const existentes = await prisma.notificacion.count({
    where: { dedupKey: { startsWith: params.dedupBase } },
  });
  const dedupKey = existentes === 0 ? params.dedupBase : `${params.dedupBase}:${existentes}`;

  const creada = await encolar(prisma, {
    tipo: params.tipo,
    destinatario: params.destinatario,
    datos: {
      nombreDestinatario: params.nombreDestinatario,
      fecha: params.fecha,
      items: pendientes.map(params.itemDe),
    },
    dedupKey,
  });
  return creada !== null;
}

/**
 * Job persistente: una vez pasada la hora configurada
 * (`recordatorio_envio_minutos`, 12:00 por defecto) encola en el outbox un
 * correo agrupado por docente y otro por formador con las formaciones
 * CONFIRMADAS que inician mañana (día calendario Bogotá). Idempotente vía
 * dedupKey; sobrevive reinicios porque corre varias veces al día.
 */
export async function procesarRecordatorios(ahoraRef: DateTime = ahora()): Promise<number> {
  const envioMin = await obtenerConfigNum("recordatorio_envio_minutos");
  const minutosDelDia = ahoraRef.hour * 60 + ahoraRef.minute;
  if (minutosDelDia < envioMin) return 0;

  const manana = ahoraRef.startOf("day").plus({ days: 1 });
  const reservas = await buscarReservasDeManana(manana, manana.plus({ days: 1 }));
  if (!reservas.length) return 0;

  const claveFecha = manana.toFormat("yyyyMMdd");
  const fechaLegible = fmt(manana);

  const porDocente = new Map<string, ReservaConDetalle[]>();
  const porFormador = new Map<string, ReservaConDetalle[]>();
  for (const r of reservas) {
    const correo = r.docenteCorreo.toLowerCase();
    porDocente.set(correo, [...(porDocente.get(correo) ?? []), r]);
    porFormador.set(r.formadorId, [...(porFormador.get(r.formadorId) ?? []), r]);
  }

  let encoladas = 0;

  for (const [correo, grupo] of porDocente) {
    const ok = await encolarGrupo({
      tipo: "RECORDATORIO_DOCENTE",
      destinatario: correo,
      nombreDestinatario: grupo[0].docenteNombre,
      dedupBase: `recordatorio-docente:${correo}:${claveFecha}`,
      fecha: fechaLegible,
      reservas: grupo,
      itemDe: (r) => ({
        curso: r.curso.nombre,
        horaInicio: fmtHora(aBogota(r.iniciaAt)),
        horaFin: fmtHora(aBogota(r.terminaAt)),
        formador: r.formador.cuenta.nombreCompleto,
        aula: r.aula ?? undefined,
        codigoReserva: r.codigo,
      }),
    });
    if (ok) encoladas++;
  }

  for (const [formadorId, grupo] of porFormador) {
    const cuenta = grupo[0].formador.cuenta;
    const ok = await encolarGrupo({
      tipo: "RECORDATORIO_FORMADOR",
      destinatario: cuenta.correo,
      nombreDestinatario: cuenta.nombreCompleto,
      dedupBase: `recordatorio-formador:${formadorId}:${claveFecha}`,
      fecha: fechaLegible,
      reservas: grupo,
      itemDe: (r) => ({
        curso: r.curso.nombre,
        horaInicio: fmtHora(aBogota(r.iniciaAt)),
        horaFin: fmtHora(aBogota(r.terminaAt)),
        aula: r.aula ?? undefined,
        docenteNombre: r.docenteNombre,
        docenteCorreo: r.docenteCorreo,
        docenteTelefono: r.docenteTelefono ?? undefined,
        codigoReserva: r.codigo,
      }),
    });
    if (ok) encoladas++;
  }

  return encoladas;
}
