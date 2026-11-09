-- Las facultades dejan de ser un catálogo administrable: quedan fijas en
-- código. Se liberan las reservas que referencian las antiguas y se crean
-- las 4 facultades institucionales.
UPDATE "Reserva" SET "facultadId" = NULL WHERE "facultadId" IS NOT NULL;
DELETE FROM "Facultad";
INSERT INTO "Facultad" (id, nombre, activo) VALUES
  ('fac_administracion', 'Facultad de Administración', true),
  ('fac_arquitectura_ingenieria', 'Facultad de Arquitectura e Ingeniería', true),
  ('fac_ciencias_salud', 'Facultad de Ciencias de la Salud', true),
  ('fac_ciencias_sociales_educacion', 'Facultad de Ciencias Sociales y Educación', true);
