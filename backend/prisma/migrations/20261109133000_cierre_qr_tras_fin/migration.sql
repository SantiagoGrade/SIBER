-- El cierre del registro de asistencia ahora se mide desde la finalización
-- del curso (antes era desde el inicio). Si la clave conserva el valor por
-- defecto anterior (240), se ajusta al nuevo por defecto (60 tras el fin);
-- valores personalizados se respetan.
UPDATE "ConfiguracionSistema"
SET valor = to_jsonb(60)
WHERE clave = 'asistencia_cierre_minutos' AND valor = '240'::jsonb;
