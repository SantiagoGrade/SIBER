-- La habilitación del registro ya no es configurable: queda abierta desde
-- el mismo momento del envío del QR (qr_envio_minutos tras el inicio).
DELETE FROM "ConfiguracionSistema" WHERE clave = 'asistencia_apertura_minutos';
