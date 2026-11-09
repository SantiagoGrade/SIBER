# SIBER — Sistema Bibliotecario de Reservas

Sistema Bibliotecario de Reservas — Institución Universitaria Colegio Mayor de Antioquia.

## Stack

- **Backend:** Node.js 20, Express, TypeScript, Prisma, PostgreSQL 16, Zod, Argon2id, JWT (cookie HttpOnly), Nodemailer, QRCode, ExcelJS.
- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS 4, React Router 7, Axios, react-big-calendar, Recharts.
- **Infra:** Docker Compose (PostgreSQL dev/test, backend, frontend+nginx).

## Arranque rápido

```bash
docker compose up -d db db-test          # PostgreSQL dev :5433 y test :5434
cd backend
cp .env.example .env                     # ajustar valores
npm install && npx prisma migrate deploy
npm run seed                             # crea Super Admin (ver consola)
npm run dev                              # API en :3005

cd ../frontend
npm install && npm run dev               # SPA en :3000 (proxy /api → :3005)
```

## Actores y accesos

- **Docente** (sin login): `/solicitar` — formulario público de solicitud.
- **Estudiante** (sin login): `/asistencia/:token` — escanea el QR de la formación.
- **Formador/Admin/SuperAdmin:** `/login` → paneles en `/formador` y `/admin`.

## Reglas clave (resumen)

- Reserva con **48 h exactas** de anticipación, confirmación automática con motor de asignación por **menor % de ocupación semanal** (horas ocupadas/horas disponibles efectivas; desempate: menos horas ocupadas, luego id estable).
- Anti-solape garantizado en PostgreSQL con **exclusion constraint** + advisory lock + serializable.
- Cancelación docente hasta **2 h antes**, por token (solo hash persistido, un solo uso, nunca por GET).
- **QR de asistencia**: se envía al formador por correo **exactamente 30 min tras el inicio** (`America/Bogota`), job persistente que sobrevive reinicios, reintenta fallos SMTP con backoff, omite canceladas, marca incidencia si la formación ya terminó, destinatario = formador vigente (reasignaciones). Token QR: solo hash + cifrado AES-GCM en DB.
- Ventana del registro: `asistencia_apertura_minutos` (30) y `asistencia_cierre_minutos` (240) configurables.
- Correos: **outbox persistente** (`Notificacion`) con dedupKey y reintentos; la reserva no depende del SMTP.
- Ver `docs/` para detalle completo.

## Pruebas

```bash
cd backend
npm test              # 94 pruebas: unitarias + integración PostgreSQL real + concurrencia + SMTP real
npm run typecheck
cd ../frontend && npm run build
```

Requiere `docker compose up -d db-test` para las integraciones.

## Variables de entorno

Ver `backend/.env.example`. Nunca versionar `.env` ni secretos.
