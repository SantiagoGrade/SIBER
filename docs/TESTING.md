# Pruebas

**114 pruebas en verde** — `cd backend && npm test` (Vitest). Las integraciones corren contra **PostgreSQL real** (`db-test` :5434) con migraciones aplicadas por `migrate deploy`, y un **servidor SMTP real de captura** (`smtp-server`, `test/integration/smtp-test.ts`) para verificar envíos, fallos y reintentos sin mocks.

## Cobertura por archivo

- `test/unit/disponibilidad.test.ts` (12): expansión de franjas, resta de intervalos, cobertura, fusión, semanas, solape de bordes.
- `test/unit/tokens.test.ts` (5): unicidad, hash determinista, cifrado AES-GCM simétrico e íntegro, formato de código.
- `test/integration/asignacion.test.ts` (10): elegibilidad, ejemplo 33 % vs 40 %, inactivos/no habilitados, bloqueos, franja parcial, solape, canceladas no cuentan, desempates, límite semanal, división por cero.
- `test/integration/reserva.test.ts` (15): flujo completo, anticipación en días de calendario, inválidos, curso inactivo, sin candidatos, **concurrencia** (1 formador → 1 reserva; 2 formadores → asignación distinta), exclusion constraint, idempotencia, **ciclo de vida** (CONFIRMADA→EN_CURSO→FINALIZADA por `iniciaAt`/`terminaAt`, EN_CURSO no cancelable ni reasignable, solape a nivel DB).
- `test/integration/cancelacion.test.ts` (7): válida + libera franja, límite exacto 2 h, fuera de plazo, token inválido/reusado, solo hash, vista previa sin efecto.
- `test/integration/reasignacion.test.ts` (10): propiedad, duplicadas, reemplazos, aprobación/rechazo, propuesta aceptada (nuevo formador + QR reprogramado) y rechazada, franja retenida.
- `test/integration/qr.test.ts` (14): envío exacto +30 min, no anticipado, cancelada→OMITIDO, **reasignación→destinatario vigente**, cambio de fecha→reprogramación, **reinicio→pendientes procesados**, fallo SMTP→reintento con backoff, sin duplicados, terminada→INCIDENCIA auditada, ventana del formulario.
- `test/integration/asistencia.test.ts` (9): flujo válido, duplicado por documento, otra formación OK, notas fuera de rango, token inválido registrado, cerrado, antes de apertura, programa inválido, listado.
- `test/integration/estadisticas.test.ts` (8): promedios desde DB, null sin datos, exclusión de canceladas, filtros curso/fecha/mes, por formador, dashboard personal, `reservasPorMes`, finalizadas sin evaluación reportadas como pendientes.
- `test/integration/cuentas.test.ts` (6): alta FORMADOR con `cursoIds` (cuenta+formador+habilitaciones), curso inexistente rechazado, `cursoIds` ignorados en roles no FORMADOR, edición con sincronización de cursos, ADMIN no gestiona administradores, cambio de rol con reservas futuras rechazado.
- `test/integration/recordatorios.test.ts` (8): no encola antes de la hora configurada, correo agrupado por docente (una y varias reservas), docentes distintos correos separados, correo único por formador, idempotencia, reserva incorporada tarde recibe solo lo no recordado, excluye canceladas y otros días.
- `test/integration/seguridad.test.ts` (10): 401 sin auth, 403 rol cruzado, jerarquía de admins, propiedad de reserva, anti-enumeración en login, recuperación informa 404 deliberado, inyección, minimización de datos públicos.

## Notas
- `vitest.config.ts`: `fileParallelism: false` (una sola DB de pruebas). Requiere `docker compose up -d db-test`.
- El schema de la DB de pruebas se aplica con `migrate deploy` desde `helpers.ts`.
