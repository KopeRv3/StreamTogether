# syntax=docker/dockerfile:1

# ---------- Etapa 1: dependencias ----------
FROM node:22-alpine AS deps
WORKDIR /app

# Solo los manifiestos primero, para que npm aproveche la cache de capas
COPY package.json package-lock.json ./
RUN npm ci

# ---------- Etapa 2: build ----------
FROM node:22-alpine AS build
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
FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

# tini da un PID 1 que reenvia senales, para que el apagado ordenado del
# servidor (SIGTERM) llegue de verdad al proceso de Node
RUN apk add --no-cache tini

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/prisma ./prisma

# `uploads` debe existir antes de que arranque el servidor
RUN mkdir -p /app/uploads && chown -R node:node /app

USER node

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]