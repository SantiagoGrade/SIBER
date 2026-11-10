# Seguridad

- **Contraseñas:** Argon2id. Política mínima 10 caracteres. Recuperación por token hasheado con expiración de 1 h y un solo uso.
- **Sesión:** JWT en cookie `HttpOnly` + `SameSite=Lax` (+`Secure` en producción). Nunca en `localStorage`. Revalidación de cuenta activa en cada request.
- **Autorización:** roles `SUPER_ADMIN > ADMIN > FORMADOR` verificados en backend por middleware + re-chequeo de propiedad (ej. asistentes de reserva propia, reasignación solo del titular). Creación/gestión de admins solo SUPER_ADMIN.
- **Tokens públicos:** SHA-256 en DB, nunca en texto plano; QR además cifrado AES-256-GCM para su envío programado. Consumo único (`usadoAt`). Acciones destructivas solo por POST (anti-mail-scanners).
- **Anti-enumeración:** el login devuelve respuestas uniformes (401 sin revelar si el usuario existe). La recuperación de contraseña sí informa con 404 si el correo no está registrado (decisión deliberada de UX para uso interno; mitigada por `limitadorPublico`).
- **Validación:** Zod estricto en todas las entradas (body/query/params); calificaciones 1–5 enteros; `express-rate-limit` en públicos (30/min lectura, 10/min escritura, 10/15min login).
- **Cabeceras:** Helmet; CORS restringido a `CORS_ORIGIN`; body limitado a 1 MB.
- **Concurrencia:** transacciones serializables + advisory lock + exclusion constraint; idempotencia por `idempotencyKey` único y `dedupKey` en outbox.
- **Datos personales:** minimización (la disponibilidad pública no expone formadores/docentes; la asistencia no lista otros estudiantes). La columna `Asistencia.aceptaTratamiento` se conserva solo como registro histórico: el formulario ya no solicita consentimiento.
- **Trazabilidad:** historial por reserva en `HistorialReserva` e intentos QR inválidos en `RegistroIntentoQr`.
- **Errores:** manejador central; sin trazas en producción.
