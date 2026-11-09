-- Limpieza de claves obsoletas: el envío del QR se reintenta hasta que la
-- ventana de registro cierre (sin tope configurable) y el texto de la
-- política de privacidad deja de ser configurable.
DELETE FROM "ConfiguracionSistema"
WHERE clave IN ('qr_max_intentos', 'politica_privacidad_texto');
