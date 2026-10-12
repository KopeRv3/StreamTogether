# Despliegue del frontend en Vercel
#
#   vercel --cwd web
#
# En el panel de Vercel: Root Directory = web, y definir VITE_API_URL con
# el dominio del backend en Render.

## Plan

| Parte | Servicio | Motivo |
|---|---|---|
| `web/` | **Vercel** (gratis) | Build estatico, ideal |
| `server/` | **Render** (gratis) | Necesita WebSockets y servidor con estado |
| Base de datos | **Postgres de Render** | SQLite no sobrevive a un reinicio |

Vercel no puede ejecutar el backend: sus funciones son sin estado, no
admiten WebSockets y el disco es efimero.

---

## 1. Backend en Render

1. Sube el repositorio a GitHub (ya está).
2. En Render: **New** → **Blueprint** → apunta a `render.yaml`.
3. Render crea el servicio y la base de datos a la vez.
4. Anota el dominio del backend: `https://streamtogether-api.onrender.com`.
5. En **Environment** del servicio, pon `CLIENT_URL` con el dominio del frontend.

> **Plan gratuito:** el servicio se duerme tras 15 minutos sin tráfico. La
> siguiente visita tarda ~1 minuto en despertar. Las salas abiertas se pierden.

---

## 2. Frontend en Vercel

Opción A — desde la terminal:

```bash
npm i -g vercel
vercel login
vercel --cwd web
```

Opción B — desde el panel:

1. **Add New** → **Project** → importa el repositorio.
2. **Root Directory**: `web`
3. Framework preset: **Vite**
4. Variable de entorno: `VITE_API_URL=https://streamtogether-api.onrender.com`
5. **Deploy**

---

## 3. Ajustar CORS

`server/.env` (en Render: Environment) debe tener exactamente el dominio
del frontend:

```bash
CLIENT_URL=https://tu-frontend.vercel.app
```

Varios dominios (producción + previews) separados por coma:

```bash
CLIENT_URL=https://tu-frontend.vercel.app,https://tu-frontend-git-main.vercel.app
```

Si no coincide, el navegador mostrará `Origen no permitido por CORS`.

---

## 4. Comprobar

| Qué | Dónde |
|---|---|
| Backend vivo | `https://tu-backend.onrender.com/api/health` |
| App | `https://tu-frontend.vercel.app` |

---

## Problemas frecuentes

**`Origen no permitido por CORS`**
`CLIENT_URL` no coincide con el dominio del frontend.

**El chat no conecta pero la app sí**
`VITE_API_URL` mal configurado. En producción no hay proxy: el socket debe
apuntar al dominio del backend.

**`502` o tarda mucho al abrir**
El servicio de Render está despertando. Es normal la primera vez.

**Las salas desaparecen**
El plan gratuito reinicia el servicio. Con plan de pago se mantiene vivo.

---

## Ampliar cuando haga falta

| Necesidad | Cambio |
|---|---|
| Más de una instancia del backend | El estado de sync está en memoria: mover a Redis (Upstash) |
| Videos subidos (no solo YouTube) | Disco persistente o S3/R2; el plan gratis no tiene disco |
| Sin que se duerma | Plan de pago en Render |

Los puntos a cambiar están marcados con comentarios en el código:

- `server/src/sockets/syncHandlers.ts` → `states` es el `Map`
- `server/src/middleware/rateLimit.ts` → `buckets` es el `Map`

---

## Desarrollo local

Requiere PostgreSQL corriendo:

```bash
npm run setup
npm run dev
```

Para levantar solo la base de datos en Docker (si lo tienes):

```bash
docker compose up -d db
```