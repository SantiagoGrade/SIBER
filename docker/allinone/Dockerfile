# ── Frontend ──────────────────────────────────────────────────────────
FROM node:20-alpine AS frontend
WORKDIR /fe
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ── Backend ───────────────────────────────────────────────────────────
FROM node:20-alpine AS backend
WORKDIR /be
COPY backend/package*.json ./
RUN npm ci
COPY backend/prisma ./prisma
RUN npx prisma generate
COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build

# ── Imagen final: Postgres + Node + Nginx ─────────────────────────────
FROM postgres:16-alpine
# openssl: sin él Prisma cae a engines openssl-1.1.x e intenta descargarlos
RUN apk add --no-cache nodejs npm nginx openssl

WORKDIR /app
COPY --from=backend /be/node_modules ./backend/node_modules
COPY --from=backend /be/dist ./backend/dist
COPY --from=backend /be/prisma ./backend/prisma
COPY --from=backend /be/package*.json ./backend/
COPY --from=frontend /fe/dist /usr/share/nginx/html
COPY docker/allinone/nginx.conf /etc/nginx/http.d/default.conf
# initdb: crea siber_test y su session timeout en volúmenes nuevos
COPY docker/initdb/ /docker-entrypoint-initdb.d/
COPY docker/allinone/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh && mkdir -p /run/nginx

EXPOSE 80 5432
ENV NODE_ENV=production PORT=3005 \
    POSTGRES_USER=siber POSTGRES_PASSWORD=siber_dev_password POSTGRES_DB=siber
ENTRYPOINT ["/entrypoint.sh"]
