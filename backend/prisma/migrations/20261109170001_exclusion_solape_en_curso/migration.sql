-- La protección anti-solape debe cubrir también las reservas EN_CURSO.
ALTER TABLE "Reserva" DROP CONSTRAINT "excl_solape_formador";
ALTER TABLE "Reserva" ADD CONSTRAINT "excl_solape_formador"
EXCLUDE USING gist (
  "formadorId" WITH =,
  tsrange("iniciaAt", "terminaAt", '[)') WITH &&
) WHERE ("estado" IN ('CONFIRMADA', 'EN_CURSO', 'FINALIZADA'));
