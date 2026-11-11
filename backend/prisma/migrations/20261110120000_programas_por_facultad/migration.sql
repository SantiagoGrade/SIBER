-- Cada programa académico queda vinculado a su facultad y la reserva del
-- docente puede registrar el programa al que pertenece.
-- AlterTable
ALTER TABLE "ProgramaAcademico" ADD COLUMN     "facultadId" TEXT;

-- AlterTable
ALTER TABLE "Reserva" ADD COLUMN     "programaAcademicoId" TEXT;

-- CreateIndex
CREATE INDEX "ProgramaAcademico_facultadId_idx" ON "ProgramaAcademico"("facultadId");

-- AddForeignKey
ALTER TABLE "ProgramaAcademico" ADD CONSTRAINT "ProgramaAcademico_facultadId_fkey" FOREIGN KEY ("facultadId") REFERENCES "Facultad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_programaAcademicoId_fkey" FOREIGN KEY ("programaAcademicoId") REFERENCES "ProgramaAcademico"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Catálogo oficial programa → facultad (upsert por nombre para respetar
-- ids existentes; los nombres nuevos crean fila propia). Los programas que
-- no estén en la lista quedan inactivos, conservando el historial de
-- asistencias que los referencie.
INSERT INTO "ProgramaAcademico" (id, nombre, "facultadId", activo) VALUES
  -- Facultad de Administración
  ('prog_tec_servicios_gastronomicos', 'Tecnología en Gestión de Servicios Gastronómicos', 'fac_administracion', true),
  ('prog_tec_gestion_turistica', 'Tecnología en Gestión Turística (virtual y presencial)', 'fac_administracion', true),
  ('prog_tec_reposteria_panificacion', 'Tecnología en Gestión de Procesos de Repostería y Panificación', 'fac_administracion', true),
  ('prog_tec_gestion_comercial', 'Tecnología en Gestión Comercial', 'fac_administracion', true),
  ('prog_tec_guianza_turistica', 'Tecnología en Gestión de Guianza Turística', 'fac_administracion', true),
  ('prog_administracion_empresas_turisticas', 'Administración de Empresas Turísticas', 'fac_administracion', true),
  ('prog_gastronomia_culinaria', 'Gastronomía y Culinaria', 'fac_administracion', true),
  ('prog_ingenieria_comercial', 'Ingeniería Comercial', 'fac_administracion', true),
  ('prog_mae_alta_direccion_organizaciones', 'Maestría en Alta Dirección de las Organizaciones', 'fac_administracion', true),
  ('prog_esp_gastronomia_colombiana', 'Especialización en Gastronomía Colombiana', 'fac_administracion', true),
  -- Facultad de Arquitectura e Ingeniería
  ('prog_tec_delineante_arquitectura_ingenieria', 'Tecnología en Delineante de Arquitectura e Ingeniería', 'fac_arquitectura_ingenieria', true),
  ('prog_tec_gestion_catastral', 'Tecnología en Gestión Catastral', 'fac_arquitectura_ingenieria', true),
  ('prog_tec_gestion_ambiental_virtual', 'Tecnología en Gestión Ambiental (virtual)', 'fac_arquitectura_ingenieria', true),
  ('prog_arquitectura', 'Arquitectura', 'fac_arquitectura_ingenieria', true),
  ('prog_construcciones_civiles', 'Construcciones Civiles', 'fac_arquitectura_ingenieria', true),
  ('prog_ingenieria_ambiental', 'Ingeniería Ambiental', 'fac_arquitectura_ingenieria', true),
  ('prog_esp_planeacion_urbana', 'Especialización en Planeación Urbana (virtual)', 'fac_arquitectura_ingenieria', true),
  ('prog_esp_construccion_sostenible', 'Especialización en Construcción Sostenible', 'fac_arquitectura_ingenieria', true),
  ('prog_esp_gestion_riesgo_desastres', 'Especialización en Gestión del Riesgo de Desastres', 'fac_arquitectura_ingenieria', true),
  ('prog_esp_gerencia_construccion', 'Especialización en Gerencia de la Construcción', 'fac_arquitectura_ingenieria', true),
  ('prog_esp_sistemas_informacion_geografica', 'Especialización en Sistemas de Información Geográfica', 'fac_arquitectura_ingenieria', true),
  -- Facultad de Ciencias de la Salud
  ('prog_seguridad_salud_trabajo', 'Seguridad y Salud en el Trabajo', 'fac_ciencias_salud', true),
  ('prog_bacteriologia_laboratorio_clinico', 'Bacteriología y Laboratorio Clínico', 'fac_ciencias_salud', true),
  ('prog_biotecnologia', 'Biotecnología', 'fac_ciencias_salud', true),
  ('prog_prof_seguridad_salud_trabajo', 'Profesional en Seguridad y Salud en el Trabajo', 'fac_ciencias_salud', true),
  ('prog_mae_biotecnologia_bioeconomia', 'Maestría en Biotecnología y Bioeconomía', 'fac_ciencias_salud', true),
  ('prog_mae_microbiologia_profundizacion', 'Maestría en Microbiología Clínica – Profundización', 'fac_ciencias_salud', true),
  ('prog_mae_microbiologia_investigacion', 'Maestría en Microbiología Clínica – Investigación', 'fac_ciencias_salud', true),
  ('prog_mae_hematologia_banco_sangre', 'Maestría en Hematología en el Laboratorio Clínico y Banco de Sangre', 'fac_ciencias_salud', true),
  -- Facultad de Ciencias Sociales y Educación
  ('prog_tec_gestion_comunitaria', 'Tecnología en Gestión Comunitaria', 'fac_ciencias_sociales_educacion', true),
  ('prog_tec_comunicacion_en_medios', 'Tecnología en Gestión de la Comunicación en Medios', 'fac_ciencias_sociales_educacion', true),
  ('prog_planeacion_desarrollo_social', 'Planeación y Desarrollo Social', 'fac_ciencias_sociales_educacion', true),
  ('prog_licenciatura_ciencias_sociales', 'Licenciatura en Ciencias Sociales', 'fac_ciencias_sociales_educacion', true),
  ('prog_comunicacion_social', 'Comunicación Social', 'fac_ciencias_sociales_educacion', true),
  ('prog_esp_prospectiva_territorial', 'Especialización en Prospectiva Territorial', 'fac_ciencias_sociales_educacion', true)
ON CONFLICT (nombre) DO UPDATE
  SET "facultadId" = EXCLUDED."facultadId", activo = true;

UPDATE "ProgramaAcademico" SET activo = false, "facultadId" = NULL
WHERE nombre NOT IN (
  'Tecnología en Gestión de Servicios Gastronómicos',
  'Tecnología en Gestión Turística (virtual y presencial)',
  'Tecnología en Gestión de Procesos de Repostería y Panificación',
  'Tecnología en Gestión Comercial',
  'Tecnología en Gestión de Guianza Turística',
  'Administración de Empresas Turísticas',
  'Gastronomía y Culinaria',
  'Ingeniería Comercial',
  'Maestría en Alta Dirección de las Organizaciones',
  'Especialización en Gastronomía Colombiana',
  'Tecnología en Delineante de Arquitectura e Ingeniería',
  'Tecnología en Gestión Catastral',
  'Tecnología en Gestión Ambiental (virtual)',
  'Arquitectura',
  'Construcciones Civiles',
  'Ingeniería Ambiental',
  'Especialización en Planeación Urbana (virtual)',
  'Especialización en Construcción Sostenible',
  'Especialización en Gestión del Riesgo de Desastres',
  'Especialización en Gerencia de la Construcción',
  'Especialización en Sistemas de Información Geográfica',
  'Seguridad y Salud en el Trabajo',
  'Bacteriología y Laboratorio Clínico',
  'Biotecnología',
  'Profesional en Seguridad y Salud en el Trabajo',
  'Maestría en Biotecnología y Bioeconomía',
  'Maestría en Microbiología Clínica – Profundización',
  'Maestría en Microbiología Clínica – Investigación',
  'Maestría en Hematología en el Laboratorio Clínico y Banco de Sangre',
  'Tecnología en Gestión Comunitaria',
  'Tecnología en Gestión de la Comunicación en Medios',
  'Planeación y Desarrollo Social',
  'Licenciatura en Ciencias Sociales',
  'Comunicación Social',
  'Especialización en Prospectiva Territorial'
);
