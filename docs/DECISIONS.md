# Decisiones técnicas y pendientes

## Tomadas
1. **PostgreSQL + Prisma + TypeScript** (stack obligatorio del prompt maestro).
2. **Cookie HttpOnly + SameSite** para sesión (el prompt prefiere cookies a localStorage). CSRF mitigado por SameSite=Lax + orígenes CORS estrictos.
3. **`tsrange` en exclusion constraint** (no `tstzrange`): columnas `timestamp without tz`; `tstzrange` es STABLE → rechazado en índice.
4. **Advisory lock por formador** + serializable + rechequeo + exclusion constraint = cuatro capas anti-doble-reserva.
5. **QR con token cifrado** (AES-256-GCM) además del hash: el envío programado necesita reconstruir el enlace tras reinicios; el hash solo valida. "No texto plano" cumplido.
6. **Outbox `Notificacion`** para todos los correos transaccionales; el QR usa su propia fila persistente (`RegistroQrFormacion`) que ya registra programación/envío/reintentos/incidencias.
7. **Cierre del QR configurable** (`asistencia_cierre_minutos`, default 60, medido desde la finalización del curso) — el prompt exige que sea configurable y documentado.
8. **Desempate del motor:** menos horas ocupadas → `formadorId` (estable, reproducible, documentado en código y tests).
9. **Jobs por `setInterval`** con reclamo optimista por fila (`updateMany` con condición de estado) → seguro con múltiples instancias y tras reinicios.
10. **`idempotencyKey` único nullable** en `Reserva` + `dedupKey` en `Notificacion` para idempotencia real.

## Pendientes / ambigüedades registradas
- QR institucional de solicitud: el enlace `/solicitar` es público y estable; generar/imprimir la imagen queda como operación simple de la Biblioteca.
- Pruebas E2E (Playwright): cubierto el contrato completo por integración HTTP + servicios; E2E de navegador sugerido como siguiente iteración.
- Retención de datos personales: purga automática sugerida como iteración posterior.
