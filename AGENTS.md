# AGENTS.md — SIBER

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
  test/integration/        Vitest; integración contra PG real :5433 (DB `siber_test`).
                           globalSetup toma advisory lock de sesión: serializa corridas
                           `npm test` concurrentes sobre la misma DB. No quitarlo.
frontend/   React 19 + TS + Vite + Tailwind 4 + react-big-calendar + recharts
  src/pages/public|auth|admin|formador
docker-compose.yml        Solo referencia de puertos/volumen. La imagen se compila con
                          `docker build` plano (NO `compose build`: eso hornea etiquetas
                          com.docker.compose.* y Docker Desktop vuelve a agrupar el contenedor):
                            docker build -f docker/allinone/Dockerfile -t siber .
                          El contenedor corre standalone para que Docker Desktop lo muestre
                          como una sola fila `siber` (sin grupo compose):
                            docker run -d --name siber --restart unless-stopped \
                              --env-file backend/.env \
                              -e DATABASE_URL="postgresql://siber:siber_dev_password@localhost:5432/siber?schema=public" \
                              -e PUBLIC_APP_URL="http://localhost:3001" -e CORS_ORIGIN="http://localhost:3001" \
                              -p 3001:80 -p 5433:5432 -v siber_siber-pgdata:/var/lib/postgresql/data siber
                          :3001 app web (proxy /api → backend), :5433 postgres (bases `siber` y `siber_test`)
docker/allinone/          Dockerfile multi-stage, nginx.conf y entrypoint.sh del contenedor único
docker/initdb/            Script que crea `siber_test` al inicializar un volumen nuevo
```

## Comandos

- Backend dev: `cd backend && npm run dev` · build: `npm run build` · tests: `npm test` (requiere db arriba; integración usa la DB `siber_test`. `test/integration/globalSetup.ts` toma un advisory lock de sesión que serializa corridas concurrentes — dos `npm test` simultáneos hacen cola, no se pisan) · typecheck: `npm run typecheck`
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
12. Modo oscuro: variante `.dark` en `<html>` (`@custom-variant` en `index.css`), gestionada por `TemaContext` (`src/context/TemaContext.tsx`, clave `siber-tema`, default = `prefers-color-scheme`, script anti-FOUC en `index.html`). Tokens oscuros: `night-950..600` (fondos/bordes azul pizarra, estilo slate-900→800) y `primary-soft` (`text-primary` en oscuro). Al añadir UI con colores fijos (`bg-white`, `text-gray-*`, `border-gray-*`), incluir siempre su variante `dark:`. Gráficas: usar `useEstilosGrafica()` de `components/graficas.tsx` (no constantes sueltas).
13. Catálogos fijos por migración: cada `ProgramaAcademico` lleva `facultadId`. En `/solicitar` facultad y programa son `ComboBox` (ui.tsx) siempre visibles y con búsqueda: la facultad filtra los programas, y elegir programa primero autoselecciona su facultad (cambiar de facultad limpia el programa si no pertenece). `Reserva.programaAcademicoId` se valida contra la facultad (y la deriva si solo llega el programa).
14. Encuesta por aspectos: `EvaluacionFormacion` tiene `contenidoObjetivo`, `metodologiaAdecuada`, `dominioTema`, `coherenciaExposicion` (todas 1–5, nullable en evaluaciones antiguas) + `calificacionGeneral`. `Asistencia.esDocente` = correo del formulario coincide con `Reserva.docenteCorreo` (case-insensitive): su evaluación se reporta aparte en `satisfaccion.porRol.docentes` (dashboard admin/formador y Excel).
