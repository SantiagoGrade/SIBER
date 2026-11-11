/**
 * Serializa corridas de integración concurrentes sobre `siber_test`.
 *
 * Varios procesos `npm test` (p. ej. la verificación automática y una
 * corrida manual) comparten la misma base: si se solapan, los TRUNCATE de
 * unos borran los datos de los otros (FK fantasma, deadlocks, conexiones
 * terminadas). Este globalSetup toma un advisory lock de SESIÓN al inicio
 * del run y lo retiene hasta el teardown — la segunda suite espera a que
 * la primera termine en vez de interferir. Si el proceso muere, Postgres
 * libera el lock automáticamente al cerrar la conexión.
 */
import { PrismaClient } from "@prisma/client";

const LOCK_KEY = 20261110;

export default async function setup() {
  const base =
    process.env.DATABASE_URL_TEST ??
    "postgresql://siber:siber_dev_password@localhost:5433/siber_test?schema=public";
  // Una sola conexión: el lock de sesión debe vivir y liberarse en la misma.
  const url = base + (base.includes("?") ? "&" : "?") + "connection_limit=1";
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    await prisma.$connect();
    // $executeRaw: pg_advisory_lock devuelve void, indeserializable via $queryRaw.
    await prisma.$executeRaw`SELECT pg_advisory_lock(${LOCK_KEY})`;
  } catch (e) {
    // Sin base accesible las pruebas unitarias no deben romperse por el lock.
    console.warn("[globalSetup] no se pudo tomar el lock de la suite:", e instanceof Error ? e.message : e);
    await prisma.$disconnect().catch(() => {});
    return async () => {};
  }
  return async () => {
    try {
      await prisma.$executeRaw`SELECT pg_advisory_unlock(${LOCK_KEY})`;
    } finally {
      await prisma.$disconnect();
    }
  };
}
