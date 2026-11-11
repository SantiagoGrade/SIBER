-- AlterTable
ALTER TABLE "Asistencia" ADD COLUMN     "esDocente" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "EvaluacionFormacion" ADD COLUMN     "coherenciaExposicion" INTEGER,
ADD COLUMN     "contenidoObjetivo" INTEGER,
ADD COLUMN     "dominioTema" INTEGER,
ADD COLUMN     "metodologiaAdecuada" INTEGER;

-- Backfill: la asistencia pertenece al docente solicitante cuando el correo
-- del formulario coincide con el correo del docente de la reserva.
UPDATE "Asistencia" a
SET "esDocente" = true
FROM "Reserva" r
WHERE a."reservaId" = r.id
  AND lower(a."correo") = lower(r."docenteCorreo");
