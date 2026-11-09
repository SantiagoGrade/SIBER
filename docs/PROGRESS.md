# Progreso

## Completado (Fase 1 + actualización del módulo de asistencia/QR/estadísticas + Fase 2)
- [x] Scaffold, docker-compose, Prisma (17 modelos), migraciones versionadas + exclusion constraint anti-solape.
- [x] Auth (Argon2id, cookie HttpOnly), roles y jerarquía, recuperación de contraseña.
- [x] Formadores, cursos M:N, disponibilidad semanal, excepciones con protección de reservas.
- [x] Motor de asignación (menor % ocupación, desempates), reservas con concurrencia real.
- [x] Cancelación docente/admin, reasignaciones, propuestas de fecha con token.
- [x] Outbox de correos persistente + 13 plantillas HTML institucionales.
- [x] QR de asistencia: programación inicio+30', job persistente, ventana configurable, token seguro, intentos inválidos.
- [x] Asistencia + evaluación en un flujo, dedup por documento, integridad 1:1.
- [x] Estadísticas admin/formador desde registros persistidos + exportaciones Excel.
- [x] Configuración del sistema.
- [x] Frontend: solicitud pública, cancelación, propuesta, asistencia+encuesta, login, paneles admin y formador completos.
- [x] 94 pruebas: unitarias + integración PostgreSQL real + concurrencia + SMTP real.
- [x] Documentación completa.

## Pendiente (ver DECISIONS.md)
- Pruebas E2E de navegador (Playwright).
- QR institucional imprimible de solicitud (URL pública estable ya disponible).
- Purga automática de retención de datos.
