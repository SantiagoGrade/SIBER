-- La evaluación se simplifica a una sola calificación (1-5) más un campo
-- libre de observaciones. Se eliminan claridad, utilidad, recomendación
-- y los dos comentarios separados.
ALTER TABLE "EvaluacionFormacion"
  DROP COLUMN "claridadFormador",
  DROP COLUMN "utilidadContenido",
  DROP COLUMN "recomendaria",
  DROP COLUMN "aspectosMejorar",
  DROP COLUMN "aspectosPositivos",
  ADD COLUMN "observaciones" TEXT;

-- Catálogo fijo de programas académicos institucionales (mismo patrón que
-- las facultades fijas). Los que no estén en la lista quedan inactivos.
INSERT INTO "ProgramaAcademico" (id, nombre, activo) VALUES
  ('prog_administracion_empresas_turisticas', 'Administración de Empresas Turísticas', true),
  ('prog_arquitectura', 'Arquitectura', true),
  ('prog_bacteriologia_laboratorio_clinico', 'Bacteriología y Laboratorio Clínico', true),
  ('prog_biotecnologia', 'Biotecnología', true),
  ('prog_comunicacion_social', 'Comunicación Social', true),
  ('prog_construcciones_civiles', 'Construcciones Civiles', true),
  ('prog_gastronomia_culinaria', 'Gastronomía y Culinaria', true),
  ('prog_ingenieria_ambiental', 'Ingeniería Ambiental', true),
  ('prog_ingenieria_comercial', 'Ingeniería Comercial', true),
  ('prog_licenciatura_ciencias_sociales', 'Licenciatura en Ciencias Sociales', true),
  ('prog_planeacion_desarrollo_social', 'Planeación y Desarrollo Social', true),
  ('prog_seguridad_salud_trabajo', 'Seguridad y Salud en el Trabajo', true),
  ('prog_tec_delineante_arquitectura_ingenieria', 'Tecnología en Delineante de Arquitectura e Ingeniería', true),
  ('prog_tec_gestion_ambiental', 'Tecnología en Gestión Ambiental', true),
  ('prog_tec_gestion_catastral', 'Tecnología en Gestión Catastral', true),
  ('prog_tec_gestion_comunitaria', 'Tecnología en Gestión Comunitaria', true),
  ('prog_tec_gestion_servicios_turisticos', 'Tecnología en Gestión de Servicios Turísticos', true),
  ('prog_tec_gestion_comunicacion_grafica', 'Tecnología en Gestión de la Comunicación Gráfica', true),
  ('prog_tec_gestion_seguridad_salud_trabajo', 'Tecnología en Gestión de la Seguridad y Salud en el Trabajo', true),
  ('prog_tec_gestion_comercial', 'Tecnología en Gestión Comercial', true),
  ('prog_tec_gestion_gastronomica', 'Tecnología en Gestión Gastronómica', true),
  ('prog_esp_gastronomia_colombiana', 'Especialización en Gastronomía Colombiana', true),
  ('prog_esp_gerencia_construccion_sostenible', 'Especialización en Gerencia de la Construcción Sostenible', true),
  ('prog_esp_gestion_riesgo_desastres', 'Especialización en Gestión del Riesgo de Desastres', true),
  ('prog_esp_planeacion_urbana_territorial', 'Especialización en Planeación Urbana y Territorial', true),
  ('prog_esp_prospectiva_territorial', 'Especialización en Prospectiva Territorial', true),
  ('prog_esp_sistemas_informacion_geografica', 'Especialización en Sistemas de Información Geográfica', true),
  ('prog_mae_alta_direccion_organizaciones', 'Maestría en Alta Dirección de las Organizaciones', true),
  ('prog_mae_biotecnologia', 'Maestría en Biotecnología', true),
  ('prog_mae_hematologia_laboratorio_clinico', 'Maestría en Hematología Laboratorio Clínico', true),
  ('prog_mae_microbiologia_clinica', 'Maestría en Microbiología Clínica', true)
ON CONFLICT DO NOTHING;

UPDATE "ProgramaAcademico" SET activo = false
WHERE id NOT IN (
  'prog_administracion_empresas_turisticas', 'prog_arquitectura',
  'prog_bacteriologia_laboratorio_clinico', 'prog_biotecnologia',
  'prog_comunicacion_social', 'prog_construcciones_civiles',
  'prog_gastronomia_culinaria', 'prog_ingenieria_ambiental',
  'prog_ingenieria_comercial', 'prog_licenciatura_ciencias_sociales',
  'prog_planeacion_desarrollo_social', 'prog_seguridad_salud_trabajo',
  'prog_tec_delineante_arquitectura_ingenieria', 'prog_tec_gestion_ambiental',
  'prog_tec_gestion_catastral', 'prog_tec_gestion_comunitaria',
  'prog_tec_gestion_servicios_turisticos', 'prog_tec_gestion_comunicacion_grafica',
  'prog_tec_gestion_seguridad_salud_trabajo', 'prog_tec_gestion_comercial',
  'prog_tec_gestion_gastronomica', 'prog_esp_gastronomia_colombiana',
  'prog_esp_gerencia_construccion_sostenible', 'prog_esp_gestion_riesgo_desastres',
  'prog_esp_planeacion_urbana_territorial', 'prog_esp_prospectiva_territorial',
  'prog_esp_sistemas_informacion_geografica', 'prog_mae_alta_direccion_organizaciones',
  'prog_mae_biotecnologia', 'prog_mae_hematologia_laboratorio_clinico',
  'prog_mae_microbiologia_clinica'
);
