# AGENTS.md — SIFOIN

Guía técnica persistente para agentes y desarrolladores.

## Estructura

```
backend/    Express + TS + Prisma + PostgreSQL
  src/routes/index.ts      Todos los endpoints bajo /api/v1
  src/controllers/         Capa HTTP delgada (sin reglas de negocio)
  src/services/            Reglas de negocio transaccionales
  src/utils/disponibilidad.ts  Matemática pura de franjas (testeable)
  src/jobs/index.ts        Jobs: outbox, QR (+30min), ciclo de vida reserva (EN_CURSO/FINALIZADA), recordatorios (día anterior 12:00, agrupados por docente/formador)
  prisma/migrations/       Migraciones versionadas (nunca db push en prod)
  test/unit|integration/   Vitest; integración contra PG real :5434
frontend/   React 19 + TS + Vite + Tailwind 4 + react-big-calendar + recharts
  src/pages/public|auth|admin|formador
docker-compose.yml        db:5433, db-test:5434, backend:3005, frontend:3001
```

## Comandos

- Backend dev: `cd backend && npm run dev` · build: `npm run build` · tests: `npm test` (requiere db-test arriba) · typecheck: `npm run typecheck`
- Migraciones: `npx prisma migrate dev` (dev) / `migrate deploy` (prod/CI). La constraint anti-solape vive en `migrations/20261108183000_exclusion_solape`. Tras `migrate`/`generate`, **reiniciar `npm run dev`**: `tsx watch` no recarga `node_modules` y el cliente Prisma queda obsoleto en memoria (500 con "column ... does not exist").
- Frontend dev: `cd frontend && npm run dev` · build: `npm run build`
- Seed: `SEED_ADMIN_EMAIL=... SEED_ADMIN_PASSWORD=... npm run seed`

## Invariantes que NO deben romperse

1. `tsrange` (no `tstzrange`) en la exclusion constraint: columnas `timestamp without tz`, `tstzrange` es STABLE y Postgres rechaza el índice.
2. Todo lo temporal en `America/Bogota` (luxon). `DisponibilidadSemanal.diaSemana` = 1..7 (lun..dom), horas en **minutos desde 00:00**.
3. Reserva: transacción Serializable + `pg_advisory_xact_lock(formadorId)` + re-chequeo de solape + exclusion constraint. No debilitar.
4. Outbox: los correos se encolan con `dedupKey` dentro de la transacción de negocio; el envío lo hace el job. Nunca `sendMail` directo en flujo de reserva (salvo QR, que tiene su propio estado persistente `RegistroQrFormacion`).
5. Tokens públicos: solo `hashToken` (SHA-256) en DB; el QR además guarda `tokenCifrado` AES-256-GCM para reconstruir el enlace en el envío programado. Nunca tokens en texto plano ni en localStorage (sesión = cookie HttpOnly).
6. Cancelación/aceptación de enlaces públicos: siempre POST con confirmación, nunca GET.
7. `estadisticas.service`: excluir siempre CANCELADA del cálculo de satisfacción; promedios `null` cuando no hay respuestas.
8. `programarQrPara` recalcula `fechaEnvioProgramado`, habilitación y cierre desde `iniciaAt` real de la reserva — llamarlo tras cualquier cambio de fecha/formador.
9. Configuración en `ConfiguracionSistema` (ver `configuracion.service.ts` DEFAULTS); no hardcodear los umbrales.
10. Al modificar modelo → migración versionada nueva; al cambiar rutas/reglas → actualizar `docs/` y esta guía.
11. Identidad visual Colmayor (ver `Estilos_Colmayor.md`): tokens `primary` `#0A6A50`, `primary-hover` `#0A6A70`, `accent` `#ADE498`. Rutas autenticadas = header blanco + degradado `from-primary to-accent`; auth = `audi.png` + overlay `primary/75`. Reutilizar `.input-base`, `.label-base`, `.btn-primary|secondary|danger`, `.card`, `.badge-*`, `.alert-*`, `.form-section` antes de crear variantes; `rounded-xl` en controles/filas, `rounded-2xl` en paneles.
