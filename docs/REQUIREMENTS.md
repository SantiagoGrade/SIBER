# Requisitos implementados

## Actores
SUPER_ADMIN, ADMIN, FORMADOR (login) · DOCENTE (público, sin login) · ESTUDIANTE (público, QR).

## Cobertura funcional
- Gestión de cuentas, formadores (cursos habilitados, disponibilidad semanal multi-franja, excepciones), cursos (M:N). Facultades y programas académicos fijos en catálogo (por migración).
- Solicitud pública del docente: catálogo dinámico, disponibilidad agregada (unión de formadores, sin exponer datos), horario flexible dentro de la franja, anticipación en días de calendario, confirmación automática.
- Motor de asignación por menor % de ocupación semanal con desempates documentados; concurrencia real contra PostgreSQL.
- Calendario del formador (día/semana/mes) con reservas, disponibilidad y bloqueos.
- Reasignaciones por calamidad: solicitud, reemplazos ordenados, aprobación/rechazo admin, propuesta de fecha con aceptación/rechazo del docente por enlace seguro, QR reprogramado.
- Cancelación docente (≤2 h antes, token de un solo uso, POST) y administrativa con motivo.
- **Asistencia + evaluación por QR:** envío automático del QR al formador a los **30 min exactos** del inicio (persistente, anti-duplicado, reintentos SMTP, omite canceladas, destinatario = formador vigente, incidencia si ya terminó); formulario público móvil con identificación + encuesta 1–5 + observaciones; dedup por documento; ventana configurable; registro de intentos inválidos.
- Notificaciones: outbox persistente con dedup, reintentos y backoff para los 12 eventos del prompt + QR.
- Dashboards: admin (reservas, carga, cursos, satisfacción global/por curso/por formador, evolución, distribución, comentarios, pendientes) y formador (ocupación semanal, impartidas, asistentes, evolución, comparación de cursos, comentarios). Filtros fecha/curso/formador/facultad/mes/semestre/año.
- Exportación Excel: reservas, estadísticas (resumen/por curso/por formador/comentarios), asistencia.
- Seguridad completa (ver SECURITY.md): Argon2id, cookies HttpOnly, rate limit, Helmet, Zod, anti-enumeración, tokens hasheados.

## Verificación
94/94 pruebas (ver TESTING.md), `tsc --noEmit` limpio en backend y frontend, build de producción OK.
