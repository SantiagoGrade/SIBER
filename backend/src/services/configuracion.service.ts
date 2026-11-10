import { prisma } from "../repositories/prisma";

/**
 * Claves de configuración con sus valores por defecto documentados.
 * - anticipacion_minima_dias: anticipación mínima para reservar en días de
 *   calendario (2 por defecto: con 2 se puede reservar desde pasado mañana).
 * - cancelacion_min_horas: límite para cancelación del docente (2 h antes).
 * - asistencia_cierre_minutos: minutos tras la finalización del curso en que
 *   se cierra el registro de asistencia/evaluación (por defecto 60).
 * - qr_envio_minutos: minutos tras el inicio en que se envía el QR al formador
 *   (30); el registro queda habilitado desde ese mismo envío. El envío se
 *   reintenta hasta que la ventana de registro cierre.
 * - recordatorio_envio_minutos: minutos desde las 00:00 (Bogotá) a partir de
 *   los cuales el job envía los recordatorios del día siguiente (720 = 12:00).
 */
const DEFAULTS: Record<string, unknown> = {
  anticipacion_minima_dias: 2,
  cancelacion_min_horas: 2,
  asistencia_cierre_minutos: 60,
  qr_envio_minutos: 30,
  recordatorio_envio_minutos: 720,
};

const cache = new Map<string, { valor: unknown; ts: number }>();
const TTL = 30_000;

export async function obtenerConfig<T = unknown>(clave: string): Promise<T> {
  const hit = cache.get(clave);
  if (hit && Date.now() - hit.ts < TTL) return hit.valor as T;
  const row = await prisma.configuracionSistema.findUnique({ where: { clave } });
  const valor = row ? row.valor : (DEFAULTS[clave] ?? null);
  cache.set(clave, { valor, ts: Date.now() });
  return valor as T;
}

export async function obtenerConfigNum(clave: string): Promise<number> {
  const v = await obtenerConfig(clave);
  return typeof v === "number" ? v : Number(v);
}

export async function guardarConfig(clave: string, valor: unknown): Promise<void> {
  await prisma.configuracionSistema.upsert({
    where: { clave },
    create: { clave, valor: valor as object },
    update: { valor: valor as object },
  });
  cache.delete(clave);
}

export function invalidarCacheConfig() { cache.clear(); }
