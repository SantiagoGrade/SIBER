-- La anticipación mínima de reserva pasa de horas a días de calendario.
-- Se convierte el valor existente (horas → días, redondeando hacia arriba).
UPDATE "ConfiguracionSistema"
SET clave = 'anticipacion_minima_dias',
    valor = to_jsonb(ceil((valor #>> '{}')::numeric / 24.0))
WHERE clave = 'anticipacion_minima_horas';
