# syntax=docker/dockerfile:1
#
# IMPORTANTE: se usa node:22-slim (Debian) y NO node:22-alpine.
#
# El motor de Prisma es un binario nativo y Alpine usa musl en lugar de glibc,
# ademas de no traer OpenSSL. Con Alpine el binario no carga y Prisma falla con:
#   "Prisma failed to detect the libssl/openssl version to use"
#   "Could not parse schema engine response"
# El contenedor muere antes de abrir el puerto y Render reporta:
#   "Port scan timeout reached, no open ports detected"
#
# El costo es una imagen mas grande, a cambio de que funcione.

# ---------- Etapa 1: dependencias ----------
FROM node:22-slim AS deps
WORKDIR /app

# Solo los manifiestos primero, para que npm aproveche la cache de capas
COPY package.json package-lock.json ./
RUN npm ci

# ---------- Etapa 2: build ----------
FROM node:22-slim AS build
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json tsconfig.json ./
COPY prisma ./prisma
COPY src ./src

# El cliente de Prisma se genera dentro de la imagen, no en el host
RUN npx prisma generate
RUN npm run build

# Se borran las dependencias de desarrollo: la imagen final no las necesita
RUN npm prune --omit=dev

# ---------- Etapa 3: ejecucion ----------
FROM node:22-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

# tini da un PID 1 que reenvia senales, para que el apagado ordenado del
# servidor (SIGTERM) llegue de verdad al proceso de Node.
# openssl lo necesita el motor de Prisma; ca-certificates, para HTTPS.
RUN apt-get update \
    && apt-get install -y --no-install-recommends tini openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/prisma ./prisma

# Las migraciones se aplican al arrancar. `migrate deploy` solo aplica las
# declaradas en prisma/migrations y nunca borra datos, a diferencia de
# `db push`, que en produccion es peligroso.
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# `uploads` debe existir antes de que arranque el servidor.
#
# Todo /app pasa a ser del usuario node porque `prisma migrate deploy` escribe
# en node_modules/@prisma/engines al resolver el motor: si esa carpeta es de
# root, falla con "Can't write to /app/node_modules/@prisma/engines" y el
# contenedor muere antes de abrir el puerto.
RUN mkdir -p /app/uploads \
    && chown -R node:node /app

USER node

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]