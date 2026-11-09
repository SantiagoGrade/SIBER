-- AlterTable
ALTER TABLE "Reserva" ADD COLUMN     "idempotencyKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Reserva_idempotencyKey_key" ON "Reserva"("idempotencyKey");
