import { DateTime, Interval } from "luxon";
import { ZONA } from "../config/env";
import { aBogota, fechaConMinutos } from "./tiempo";

export interface FranjaSemanal {
  /** 1 = lunes … 7 = domingo */
  diaSemana: number;
  /** minutos desde 00:00 hora local */
  horaInicio: number;
  horaFin: number;
}

export interface Intervalo {
  inicio: DateTime;
  fin: DateTime;
}

/**
 * Expande la disponibilidad semanal recurrente a intervalos concretos
 * dentro de [desde, hasta) en zona America/Bogota.
 */
export function expandirDisponibilidad(
  franjas: FranjaSemanal[],
  desde: DateTime,
  hasta: DateTime
): Intervalo[] {
  const resultado: Intervalo[] = [];
  let dia = desde.setZone(ZONA).startOf("day");
  const fin = hasta.setZone(ZONA);
  while (dia < fin) {
    for (const f of franjas) {
      if (f.diaSemana !== dia.weekday) continue;
      if (f.horaInicio >= f.horaFin) continue;
      const ini = fechaConMinutos(dia, f.horaInicio);
      const finF = fechaConMinutos(dia, f.horaFin);
      if (finF > desde && ini < hasta) {
        resultado.push({ inicio: ini > desde ? ini : desde, fin: finF < hasta ? finF : hasta });
      }
    }
    dia = dia.plus({ days: 1 });
  }
  return resultado.sort((a, b) => a.inicio.toMillis() - b.inicio.toMillis());
}

/** Resta los intervalos `ocupados` de los `libres`. Devuelve intervalos ordenados sin solapes. */
export function restarIntervalos(libres: Intervalo[], ocupados: Intervalo[]): Intervalo[] {
  const ocup = ocupados
    .filter(o => o.fin > o.inicio)
    .sort((a, b) => a.inicio.toMillis() - b.inicio.toMillis());
  const resultado: Intervalo[] = [];
  for (const libre of libres) {
    let segmentos: Intervalo[] = [{ inicio: libre.inicio, fin: libre.fin }];
    for (const oc of ocup) {
      const siguientes: Intervalo[] = [];
      for (const s of segmentos) {
        if (oc.fin <= s.inicio || oc.inicio >= s.fin) { siguientes.push(s); continue; }
        if (oc.inicio > s.inicio) siguientes.push({ inicio: s.inicio, fin: oc.inicio });
        if (oc.fin < s.fin) siguientes.push({ inicio: oc.fin, fin: s.fin });
      }
      segmentos = siguientes;
      if (segmentos.length === 0) break;
    }
    resultado.push(...segmentos);
  }
  return resultado.sort((a, b) => a.inicio.toMillis() - b.inicio.toMillis());
}

/** ¿[inicio, fin) queda completamente cubierto por `intervalos` (sin huecos)? */
export function intervaloCubierto(inicio: DateTime, fin: DateTime, intervalos: Intervalo[]): boolean {
  if (fin <= inicio) return false;
  let cursor = inicio;
  for (const i of intervalos.sort((a, b) => a.inicio.toMillis() - b.inicio.toMillis())) {
    if (i.fin <= cursor) continue;
    if (i.inicio > cursor) return false; // hueco
    cursor = i.fin > cursor ? i.fin : cursor;
    if (cursor >= fin) return true;
  }
  return cursor >= fin;
}

/** Minutos totales de un conjunto de intervalos ya disjuntos. */
export function minutosTotales(intervalos: Intervalo[]): number {
  return intervalos.reduce((acc, i) => acc + i.fin.diff(i.inicio, "minutes").minutes, 0);
}

/** Fusiona intervalos solapados o contiguos. */
export function fusionar(intervalos: Intervalo[]): Intervalo[] {
  const ordenados = [...intervalos].sort((a, b) => a.inicio.toMillis() - b.inicio.toMillis());
  const out: Intervalo[] = [];
  for (const i of ordenados) {
    const ultimo = out[out.length - 1];
    if (ultimo && i.inicio <= ultimo.fin) {
      if (i.fin > ultimo.fin) ultimo.fin = i.fin;
    } else {
      out.push({ ...i });
    }
  }
  return out;
}

/** Convierte rango DateTime a Interval de Luxon (útil en depuración) */
export function aInterval(i: Intervalo): Interval {
  return Interval.fromDateTimes(aBogota(i.inicio.toJSDate()), aBogota(i.fin.toJSDate()));
}
