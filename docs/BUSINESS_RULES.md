# Reglas de negocio

## Reservas
- Anticipación: **`anticipacion_minima_dias` días de calendario** (2 por defecto): el día completo cuenta — con 2 se reserva desde pasado mañana 00:00, zona `America/Bogota`.
- Confirmación automática transaccional: valida curso activo → motor de asignación → reserva + historial + token cancelación + QR programado + outbox.
- Estados: `CONFIRMADA → EN_CURSO → FINALIZADA`, o `CANCELADA` (solo desde `CONFIRMADA`). El job `estados-reserva` ejecuta ambas transiciones según `iniciaAt`/`terminaAt` (idempotente) y los listados de reservas la sincronizan de forma perezosa. `incidenciaPendiente` marca reasignación en curso sin cambiar el estado.

## Motor de asignación
- Elegible: activo + habilitado para el curso + disponibilidad efectiva cubre todo el intervalo + sin solapes + sin excepciones.
- Orden: menor `% ocupación semanal` (horas ocupadas ÷ horas disponibles efectivas lun–dom, minutos exactos); desempate: menos horas ocupadas, luego `formadorId`. Excluye canceladas; evita división por cero (∞ si 0 disponibles).

## Disponibilidad
- Semanal recurrente por día (1–7) en minutos, varias franjas/día, sin solapes internos.
- Excepciones (vacaciones, incapacidad, calamidad, permiso, bloqueo, fecha especial) se restan de la efectiva.
- No se puede quitar cobertura a reservas confirmadas futuras sin resolverlas.

## Cancelación docente
- Enlace tokenizado hasta **2 h antes** del inicio. Hash único, un solo uso, requiere POST (nunca GET). Libera la franja e invalida el QR.

## Reasignación por calamidad
- Formador solicita → admin aprueba reemplazo elegible (revalidado en el momento), marca `SIN_REEMPLAZO`, propone nueva fecha al docente (enlace seguro) o cancela la reserva.
- Docente acepta → recalcula formador en la nueva fecha, reprograma QR y token de cancelación; rechaza → vuelve a `SIN_REEMPLAZO` para otra propuesta.
- La franja original sigue ocupada mientras no haya resolución.
- El docente no recibe correo por el cambio interno de formador al aprobar la reasignación; solo se le escribe si la reserva se cancela por no poder reasignarse (y la propuesta de fecha, que debe responder).

## QR de asistencia y evaluación (actualización)
- Envío del correo **exactamente inicio + 30 min** (`qr_envio_minutos`), al formador **vigente** al momento del envío; el registro queda habilitado desde ese mismo envío. Cierre: **fin del curso + `asistencia_cierre_minutos`** (60 por defecto) — configurable en `ConfiguracionSistema`.
- El job reintenta fallos SMTP con backoff (tope 60 min) hasta que la ventana de registro cierre — el QR se envía sí o sí mientras sirva; omite canceladas, marca `INCIDENCIA` si la ventana ya cerró, nunca duplica.
- Formulario público: asistencia + encuesta en un solo flujo. Una asistencia y una evaluación por documento por formación (`@@unique(reservaId, documento)` y `asistenciaId @unique`).
- Encuesta: calificación general obligatoria (1–5 entero) y observaciones opcionales. Programa académico: catálogo fijo institucional (campo con búsqueda/filtro).

## Recordatorios del día anterior
- A partir de las **12:00 Bogotá** (`recordatorio_envio_minutos`, 720 por defecto) el job `recordatorios` encola correos para las reservas `CONFIRMADA` que inician **mañana** (día calendario Bogotá).
- Un correo agrupado por **docente** (con todas sus formaciones de mañana) y uno por **formador** (con aula, correo y teléfono del docente de cada formación).
- Idempotente vía `dedupKey` por destinatario + fecha; una reserva incorporada tarde a mañana (p. ej. reagendada tras las 12:00) recibe un correo adicional solo con las reservas aún no recordadas.

## Estadísticas
- Solo registros persistidos; excluyen canceladas y duplicados; promedios `null` sin respuestas; se muestra `respuestas` junto a cada promedio; tasa = evaluaciones ÷ asistencias.
