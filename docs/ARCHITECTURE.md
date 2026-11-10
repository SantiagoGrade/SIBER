# Arquitectura

```
Navegador → Vite dev proxy / nginx → Express /api/v1 → Prisma → PostgreSQL
                                           └→ jobs: outbox, QR(+30'), finalización, recordatorios
```

## Capas backend (`backend/src`)

- `routes/index.ts` — composición de routers `/api/v1` (auth, público, admin, formador).
- `controllers/` — traducen HTTP ↔ servicios; sin reglas de negocio.
- `services/` — lógica transaccional: reservas, asignación, disponibilidad, reasignación, QR, asistencia, notificaciones (outbox), correo + plantillas HTML, recordatorios, estadísticas, exportación, cuentas, catálogos, configuración.
- `utils/` — funciones puras: matemática de franjas (`disponibilidad.ts`), tiempo Bogotá (`tiempo.ts`), tokens/cifrado (`tokens.ts`), errores.
- `middleware/` — JWT cookie (`auth.ts`), Zod + rate limiting (`validate.ts`), errores centralizados (`errors.ts`).
- `jobs/` — `procesarOutbox` (15 s), `procesarEnviosQr` (30 s), `sincronizarEstadosReservas` (10 min), `procesarRecordatorios` (5 min); estado persistido → sobreviven reinicios.

## Decisiones estructurales

- **Concurrencia:** transacciones `Serializable` + `pg_advisory_xact_lock(formadorId)` + exclusion constraint GIST `tsrange` en `Reserva` (defensa en profundidad; ver `reserva.service.ts` y migración `exclusion_solape`).
- **Outbox:** `Notificacion` persistente con `dedupKey`, `programadaPara`, backoff `2^intentos` min. Los correos nunca se envían dentro de la transacción de negocio.
- **QR:** `RegistroQrFormacion` guarda hash (validación pública) + token cifrado AES-256-GCM (reconstrucción del enlace en el envío programado post-reinicio).
- **Frontend:** separación público/admin/formador por rutas; cookie HttpOnly (sin tokens en localStorage); react-big-calendar para calendarios; recharts para dashboards.
