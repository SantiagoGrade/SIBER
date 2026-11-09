import { prisma, Tx } from "../repositories/prisma";
import { DateTime } from "luxon";
import { aBogota, inicioSemana, finSemana, minutosSolape } from "../utils/tiempo";
import {
  expandirDisponibilidad, restarIntervalos, intervaloCubierto,
  minutosTotales, fusionar, Intervalo, FranjaSemanal,
} from "../utils/disponibilidad";

type Db = typeof prisma | Tx;

/**
 * Franjas de disponibilidad efectiva de un formador en [desde, hasta):
 * disponibilidad semanal expandida − excepciones − reservas CONFIRMADAS/FINALIZADAS.
 */
export async function franjasEfectivas(
  db: Db,
  formadorId: string,
  desde: DateTime,
  hasta: DateTime,
  excluirReservaId?: string
): Promise<Intervalo[]> {
  const [semanal, excepciones, reservas] = await Promise.all([
    db.disponibilidadSemanal.findMany({ where: { formadorId } }),
    db.excepcionDisponibilidad.findMany({
      where: { formadorId, iniciaAt: { lt: hasta.toJSDate() }, terminaAt: { gt: desde.toJSDate() } },
    }),
    db.reserva.findMany({
      where: {
        formadorId,
        estado: { in: ["CONFIRMADA", "FINALIZADA"] },
        iniciaAt: { lt: hasta.toJSDate() },
        terminaAt: { gt: desde.toJSDate() },
        ...(excluirReservaId ? { id: { not: excluirReservaId } } : {}),
      },
      select: { iniciaAt: true, terminaAt: true },
    }),
  ]);

  const franjas: FranjaSemanal[] = semanal.map(f => ({
    diaSemana: f.diaSemana, horaInicio: f.horaInicio, horaFin: f.horaFin,
  }));
  const base = expandirDisponibilidad(franjas, desde, hasta);
  const ocupados: Intervalo[] = [
    ...excepciones.map(e => ({ inicio: aBogota(e.iniciaAt), fin: aBogota(e.terminaAt) })),
    ...reservas.map(r => ({ inicio: aBogota(r.iniciaAt), fin: aBogota(r.terminaAt) })),
  ];
  return restarIntervalos(base, ocupados);
}

/** ¿El formador cubre íntegramente [inicio, fin) con su disponibilidad efectiva? */
export async function cubreIntervalo(
  db: Db, formadorId: string, inicio: DateTime, fin: DateTime, excluirReservaId?: string
): Promise<boolean> {
  const efectivas = await franjasEfectivas(db, formadorId, inicio, fin, excluirReservaId);
  return intervaloCubierto(inicio, fin, efectivas);
}

export interface CargaSemanal {
  minutosDisponibles: number;
  minutosOcupados: number;
  ocupacion: number; // porcentaje 0-100
}

/**
 * Carga semanal de un formador para la semana (lunes-domingo) que contiene `fecha`.
 * disponibles = franjas semanales − excepciones (solo hasta el fin de semana).
 * ocupadas = solape de reservas confirmadas/finalizadas con la disponibilidad efectiva.
 */
export async function cargaSemanal(db: Db, formadorId: string, fecha: DateTime): Promise<CargaSemanal> {
  const ini = inicioSemana(fecha);
  const fin = finSemana(fecha);
  const [semanal, excepciones, reservas] = await Promise.all([
    db.disponibilidadSemanal.findMany({ where: { formadorId } }),
    db.excepcionDisponibilidad.findMany({
      where: { formadorId, iniciaAt: { lt: fin.toJSDate() }, terminaAt: { gt: ini.toJSDate() } },
    }),
    db.reserva.findMany({
      where: {
        formadorId,
        estado: { in: ["CONFIRMADA", "FINALIZADA"] },
        iniciaAt: { lt: fin.toJSDate() },
        terminaAt: { gt: ini.toJSDate() },
      },
      select: { iniciaAt: true, terminaAt: true },
    }),
  ]);

  const base = expandirDisponibilidad(
    semanal.map(f => ({ diaSemana: f.diaSemana, horaInicio: f.horaInicio, horaFin: f.horaFin })),
    ini, fin
  );
  const efectivas = restarIntervalos(
    base,
    excepciones.map(e => ({ inicio: aBogota(e.iniciaAt), fin: aBogota(e.terminaAt) }))
  );

  // Las horas ocupadas se cuentan como la porción de reserva que cae dentro de
  // la disponibilidad efectiva (una reserva siempre cae dentro de la
  // disponibilidad que la permitió, salvo ediciones posteriores).
  let minutosOcup = 0;
  for (const r of reservas) {
    for (const e of efectivas) {
      minutosOcup += minutosSolape(aBogota(r.iniciaAt), aBogota(r.terminaAt), e.inicio, e.fin);
    }
  }

  const minutosDisp = minutosTotales(efectivas);
  const ocupacion = minutosDisp > 0 ? (minutosOcup / minutosDisp) * 100 : Infinity;
  return { minutosDisponibles: minutosDisp, minutosOcupados: minutosOcup, ocupacion };
}

/**
 * Unión de franjas efectivas de varios formadores (vista pública de disponibilidad).
 */
export async function franjasUnion(
  db: Db, formadorIds: string[], desde: DateTime, hasta: DateTime
): Promise<Intervalo[]> {
  const todas: Intervalo[] = [];
  for (const id of formadorIds) {
    todas.push(...await franjasEfectivas(db, id, desde, hasta));
  }
  return fusionar(todas);
}

/**
 * Unión de los intervalos ocupados por reservas CONFIRMADAS/FINALIZADAS
 * de varios formadores (vista pública: solo instantes, sin identidades).
 */
export async function reservasUnion(
  db: Db, formadorIds: string[], desde: DateTime, hasta: DateTime
): Promise<Intervalo[]> {
  if (!formadorIds.length) return [];
  const reservas = await db.reserva.findMany({
    where: {
      formadorId: { in: formadorIds },
      estado: { in: ["CONFIRMADA", "FINALIZADA"] },
      iniciaAt: { lt: hasta.toJSDate() },
      terminaAt: { gt: desde.toJSDate() },
    },
    select: { iniciaAt: true, terminaAt: true },
  });
  return fusionar(reservas.map(r => ({ inicio: aBogota(r.iniciaAt), fin: aBogota(r.terminaAt) })));
}
