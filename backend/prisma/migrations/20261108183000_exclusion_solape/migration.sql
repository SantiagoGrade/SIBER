-- Protección anti-solape: imposible persistir dos reservas activas
-- (CONFIRMADA/FINALIZADA) del mismo formador con intervalos superpuestos.
-- Las columnas son "timestamp without time zone" (Prisma) pero contienen
-- instantes reales; tsrange es IMMUTABLE y el solape es equivalente.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Reserva" ADD CONSTRAINT "excl_solape_formador"
EXCLUDE USING gist (
  "formadorId" WITH =,
  tsrange("iniciaAt", "terminaAt", '[)') WITH &&
) WHERE ("estado" IN ('CONFIRMADA', 'FINALIZADA'));
