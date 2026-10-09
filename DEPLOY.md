# Guía de despliegue

## Por qué el frontend y el backend van a partes

| | Requisitos | Vercel sirve? |
|---|---|---|
| Frontend | Archivos estáticos | ✅ Sí |
| Backend | Express con estado | ❌ No |
| WebSockets | Servidor TCP persistente | ❌ No |
| SQLite | Disco persistente | ❌ No (efímero) |
| Peticiones | Hasta 500 MB | ❌ No (~4.5 MB) |

Vercel ejecuta funciones sin estado: cada invocación puede morir en cualquier momento y no puede mantener un socket abierto. Por eso el backend necesita un servicio con servidor real.

---

## Plan recomendado

```
web/    →  Vercel                    (frontend estático, gratis)
server/ →  Railway / Render / Fly.io  (Express + Socket.IO)
DB      →  Neon o Supabase           (Postgres, gratis)
videos  →  Cloudflare R2 / Supabase   (solo si mantienes la subida de archivos)
```

---

## 1. Base de datos

1. Crea una cuenta en [Neon](https://neon.tech) o Supabase y una base Postgres.
2. Copia la cadena de conexión (`postgresql://...`).
3. En `server/prisma/schema.prisma` cambia el proveedor:

```prisma
datasource db {
  provider = "postgresql"   // antes: sqlite
  url      = env("DATABASE_URL")
}
```

4. En `server/.env`:

```bash
DATABASE_URL="postgresql://usuario:password@host/db?sslmode=require"
```

5. Aplica el esquema:

```bash
cd server
npx prisma generate
npx prisma migrate deploy
```

---

## 2. Backend

### Railway

1. `New Project` → `Deploy from GitHub Repo` → selecciona el repositorio.
2. Railway detecta el monorepo; configura el directorio como `server`.
3. Build command: `npm ci && npx prisma generate && npx prisma migrate deploy`
4. Start command: `npm start`
5. Variables de entorno:

```bash
NODE_ENV=production
PORT=3001                      # Railway lo inyecta, no lo fijes
DATABASE_URL=postgresql://...
JWT_SECRET=<64+ caracteres aleatorios>
JWT_EXPIRES_IN=7d
CLIENT_URL=https://tu-frontend.vercel.app
UPLOAD_DIR=/tmp/uploads        # disco temporal del contenedor
MAX_FILE_SIZE=524288000
```

6. Railway asigna un dominio: `https://tu-backend.up.railway.app`.

> **Sobre `UPLOAD_DIR`:** si lo dejas en `/tmp`, los archivos se pierden en cada reinicio. Para producción usa almacenamiento externo (S3/R2) o desactiva la subida de archivos y quédate solo con YouTube.

### Render

Alternativa con plan gratuito (se duerme tras 15 min de inactividad, lo que corta las salas).

---

## 3. Frontend en Vercel

1. `Add New` → `Project` → importa el repositorio.
2. Configura el **Root Directory** como `web`.
3. Framework preset: Vite.
4. Variables de entorno:

```bash
VITE_API_URL=https://tu-backend.up.railway.app
```

5. Deploy.

---

## 4. Configurar CORS

`server/.env` debe incluir **exactamente** el dominio final del frontend:

```bash
CLIENT_URL=https://tu-frontend.vercel.app
```

Para varios dominios (producción + preview) separados por coma:

```bash
CLIENT_URL=https://tu-frontend.vercel.app,https://tu-frontend-git-main-equipo.vercel.app
```

Si no coincide con el dominio correcto verás `Origen no permitido por CORS` en la consola del navegador.

---

## 5. Lista de verificación

Antes de abrirlo al público:

- [ ] `JWT_SECRET` es aleatorio y **distinto** del de ejemplo
- [ ] `NODE_ENV=production`
- [ ] `CLIENT_URL` apunta a tu dominio real
- [ ] El esquema de Prisma está en Postgres, no en SQLite
- [ ] `VITE_API_URL` apunta al backend
- [ ] El backend es accesible por HTTPS
- [ ] `npm test` pasa completo

---

## Problemas frecuentes

**`Origen no permitido por CORS`**
`CLIENT_URL` no coincide con el dominio del frontend, con la barra final incluida.

**El chat no conecta, la API sí**
`VITE_API_URL` mal configurado, o el proxy de `/socket.io` falta. En producción el frontend y el backend están en dominios distintos, así que no hay proxy: la URL del socket debe ser la del backend.

**Las salas se desincronizan**
El estado de sync vive en memoria. Con una sola instancia funciona; con varias hay que moverlo a Redis.

**Los videos subidos desaparecen**
El disco del contenedor es temporal. Sube los videos a S3/R2 o quédate solo con YouTube.

**`SQLITE_BUSY` o base vacía**
Quedó apuntando a SQLite. Revisa `provider` en `schema.prisma` y `DATABASE_URL`.

---

## Escalado a varias instancias

Cuando el tráfico lo justifique, el estado en memoria deja de servir:

1. **Sync y presencia** → Redis (Upstash) en lugar de `Map`
2. **Base de datos** → Postgres con pool de conexiones (PgBouncer)
3. **Sesiones** → los JWT no dependen del servidor, así que ya escalan solos
4. **Rate limiting** → mover los contadores a Redis; hoy son por proceso

Los puntos exactos a cambiar están marcados con comentarios en el código:

- `server/src/sockets/syncHandlers.ts` → `states` es el `Map`
- `server/src/middleware/rateLimit.ts` → `buckets` es el `Map`