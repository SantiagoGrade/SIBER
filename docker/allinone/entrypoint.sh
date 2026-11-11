#!/bin/sh
set -e

export POSTGRES_USER=${POSTGRES_USER:-siber}
export POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-siber_dev_password}
export POSTGRES_DB=${POSTGRES_DB:-siber}

# Postgres en background; su entrypoint oficial hace initdb en volumen
# vacío y ejecuta /docker-entrypoint-initdb.d (crea siber_test).
docker-entrypoint.sh postgres &

for i in $(seq 1 60); do
  pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" -h localhost >/dev/null 2>&1 && break
  sleep 1
done

export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:5432/${POSTGRES_DB}?schema=public"

cd /app/backend
npx prisma migrate deploy
node dist/src/server.js &

# nginx en foreground mantiene vivo el contenedor
exec nginx -g 'daemon off;'
