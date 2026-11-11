import { PrismaClient } from "@prisma/client";

// timeout generoso: hay hashing argon2 y locks (advisory/serializable) dentro
// de las txs; el default de 5s expira bajo carga y una tx interactiva que
// expira deja la conexión del pool atrapada en una transacción abierta,
// sirviendo snapshots viejos (FK fantasma, lecturas inconsistentes).
export const prisma = new PrismaClient({
  transactionOptions: { timeout: 30_000, maxWait: 10_000 },
});
export type Tx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;
