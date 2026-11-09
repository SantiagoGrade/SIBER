import { DateTime } from "luxon";
import { ZONA } from "../config/env";

/** Convierte Date/DateTime a DateTime en zona Bogotá */
export function aBogota(d: Date | DateTime): DateTime {
  return d instanceof Date ? DateTime.fromJSDate(d, { zone: ZONA }) : d.setZone(ZONA);
}

/** Combina una fecha calendario (DateTime en Bogotá) con minutos desde 00:00 */
export function fechaConMinutos(fecha: DateTime, minutos: number): DateTime {
  return fecha.startOf("day").plus({ minutes: minutos });
}

/** Inicio de la semana (lunes 00:00 Bogotá) que contiene a `d` */
export function inicioSemana(d: Date | DateTime): DateTime {
  return aBogota(d).startOf("week"); // Luxon: semana inicia lunes
}

export function finSemana(d: Date | DateTime): DateTime {
  return inicioSemana(d).endOf("week");
}

/** Minutos de solape entre [a1,a2) y [b1,b2). */
export function minutosSolape(a1: DateTime, a2: DateTime, b1: DateTime, b2: DateTime): number {
  const ini = a1 > b1 ? a1 : b1;
  const fin = a2 < b2 ? a2 : b2;
  const m = fin.diff(ini, "minutes").minutes;
  return Math.max(0, m);
}

export function ahora(): DateTime {
  return DateTime.now().setZone(ZONA);
}
