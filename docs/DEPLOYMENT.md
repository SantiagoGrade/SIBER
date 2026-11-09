# Despliegue

## Requisitos
Docker + Docker Compose. Producción: nginx del frontend sirve la SPA y proxifica `/api` → backend:3005.

## Pasos
```bash
cp backend/.env.example backend/.env   # completar valores reales
docker compose up -d --build
# Primera vez: crear el Super Admin
docker compose exec backend npx tsx prisma/seed.ts
```

- `db` persiste en volumen `sifoin-pgdata` (`postgres:16-alpine`).
- `backend`: `migrate deploy` automático al arrancar (ver `backend/Dockerfile`).
- `frontend`: nginx :3001.

## Variables de entorno (backend/.env)
`DATABASE_URL`, `JWT_SECRET` (largo y aleatorio), `CORS_ORIGIN`, `PUBLIC_APP_URL` (para enlaces de correos), `SMTP_*`, `SEED_ADMIN_*`, `PORT`, intervalos de jobs (`OUTBOX_POLL_MS`, `QR_JOB_POLL_MS`, `FINALIZA_JOB_POLL_MS`).

## SMTP
Cualquier SMTP compatible con Nodemailer. El outbox y el envío del QR toleran SMTP caído (reintentos con backoff, estado persistido).

## Producción — checklist
1. `JWT_SECRET` fuerte; `NODE_ENV=production` (cookie Secure).
2. `CORS_ORIGIN` = dominio real; `PUBLIC_APP_URL` = URL pública.
3. Backups del volumen PostgreSQL.
4. Cambiar la contraseña del Super Admin semilla tras el primer acceso.
5. Revisar `ConfiguracionSistema`: umbrales (anticipación en días, cancelación 2 h, QR: envío a inicio+30 min y cierre a fin+margen).
