# StreamTogether

Aplicación de streaming social: dos o más personas ven el **mismo video al mismo tiempo** y chatean en tiempo real.

Funciona con **videos de YouTube** (pegas la URL y listo) y con **archivos locales** (MP4, WebM, MOV). Ambos se reproducen sincronizados: el anfitrión controla la reproducción y todos los demás ven exactamente lo mismo.

## Cómo funciona

```
┌──────────────┐         REST (JWT)        ┌─────────────────┐
│   Frontend   │ ────────────────────────► │                 │
│ React + Vite │                           │   Backend       │
│              │ ◄──────────────────────── │ Express +       │
└──────┬───────┘       WebSocket            │ Socket.IO       │
       │                                    │                 │
       │  el anfitrión manda play/pause/    │                 │
       │  seek, los demás lo replican       └────────┬────────┘
       │                                                  │
       │                                          ┌───────▼──────┐
       └──── YouTube IFrame Player API ──────────►│    Prisma    │
            (para poder leer/escribir            │   SQLite     │
             la posición del video)              └──────────────┘
```

El punto delicado es la sincronización. Para mover el video de otra persona hay que poder **leer y escribir `currentTime`**, y un `<iframe>` normal lo prohíbe por seguridad de origen. Por eso se usa la **IFrame Player API de YouTube**, que sí lo permite. Por eso mismo el player local y el de YouTube comparten una interfaz de controles idéntica (`play` / `pause` / `seek` / `getCurrentTime`).

## Estructura

```
streamtogether/
├── server/          Backend: Node.js + Express + Socket.IO + Prisma
│   ├── prisma/      Esquema y cliente de la base de datos
│   └── src/
│       ├── routes/      Endpoints REST
│       ├── services/    Lógica de negocio
│       ├── sockets/     Eventos en tiempo real
│       ├── middleware/  Autenticación, rate limiting, errores
│       └── utils/       JWT, códigos de sala, URLs de YouTube
├── web/             Frontend: React 18 + TypeScript + Vite + Tailwind
│   └── src/
│       ├── components/room/   Players, chat, lista de participantes
│       ├── hooks/             useMediaSync (sincronización compartida)
│       └── lib/               API, socket, IFrame API de YouTube
└── tests/           Suite end-to-end (71 comprobaciones)
```

## Requisitos

- Node.js 18 o superior
- npm

## Configuración inicial

```bash
# Instalar dependencias (raíz, server y web)
npm run install:all

# Configurar el backend
cd server
cp .env.example .env          # en Windows: copy .env.example .env
npm run db:generate
npm run db:push               # crea la base de datos
cd ..
```

## Uso en desarrollo

Dos terminales:

```bash
# Terminal 1 - backend en http://localhost:3001
npm run dev:server

# Terminal 2 - frontend en http://localhost:5173
npm run dev:web
```

Abre `http://localhost:5173`, regístrate, crea una sala y comparte el código de 6 caracteres.

> **Importante:** el proxy de Vite enruta `/api`, `/uploads` **y `/socket.io`** al backend. Si falta `/socket.io` en `vite.config.ts`, el handshake recibe el `index.html` y toda la parte de tiempo real deja de funcionar sin dar ningún error visible.

## Pruebas

```bash
# Levanta un backend limpio y corre toda la suite
powershell -File tests/run.ps1

# O, con el servidor ya corriendo
node tests/e2e.mjs

# Verificar el proxy de Vite (con server y web levantados)
node tests/proxy-check.mjs
```

La suite cubre autenticación, salas, URLs de YouTube, control de acceso, propiedad de videos, sincronización real por WebSocket y rate limiting.

## Agregar un video

- **YouTube** — ve a *Agregar contenido*, pega la URL y listo. Acepta `watch?v=`, `youtu.be`, `embed`, `shorts` y `live`.
- **Archivo** — arrastra el MP4/WebM/MOV (máx 500 MB). Los archivos se guardan en el disco del servidor, así que en un hosting efímero habría que moverlos a almacenamiento externo.

## Seguridad

Lo que el proyecto protege explícitamente:

| Riesgo | Mitigación |
|---|---|
| Leer salas ajenas | `GET /api/rooms/:id` y `/messages` exigen ser participante activo |
| Controlar el video sin ser anfitrión | El servidor verifica el rol contra la base de datos, no confía en el cliente |
| Borrar videos de otros | `Video` tiene `ownerId`; el `DELETE` valida propiedad |
| Chatear en salas ajenas | Los handlers de chat comprueban participación (con caché por conexión) |
| Fuerza bruta | Rate limiting: 10 intentos de auth / 15 min, 20 subidas / hora |
| XSS y sniffing | `helmet` + CORS con lista explícita de orígenes |
| Path traversal al borrar | `path.basename` + comparación del directorio |
| Video con contenido inapropiado | No se puede forzar: el player delega en YouTube y respeta su embed |

## Despliegue

El frontend y el backend tienen requisitos distintos y **no van al mismo servicio**:

| Parte | Plataforma sugerida | Motivo |
|---|---|---|
| Frontend (Vite) | **Vercel** | Build estático, gratis, ideal |
| Backend + WebSockets | **Railway**, Render o Fly.io | Necesita un servidor con estado y TCP abierto |
| Base de datos | **Neon** o Supabase (Postgres) | SQLite no sirve en disco efímero |
| Videos subidos | Cloudflare R2 o Supabase Storage | El disco local no persiste |

Vercel **no** puede ejecutar el backend: sus funciones son sin estado, sin WebSockets y con límite de ~4.5 MB por petición.

En producción hay que cambiar además:

- `prisma/schema.prisma`: `provider = "postgresql"`
- `web/.env`: `VITE_API_URL=https://tu-backend`
- `server/.env`: `CLIENT_URL=https://tu-frontend`, `JWT_SECRET` aleatorio
- El estado de sincronización vive en memoria, así que con más de una réplica hay que moverlo a Redis

Ver [`DEPLOY.md`](./DEPLOY.md) para la guía paso a paso.

## Stack

**Frontend** React 18 · TypeScript · Vite · Tailwind CSS · Zustand · React Router
**Backend** Node.js · Express · TypeScript · Socket.IO · Prisma
**Otros** bcrypt · jsonwebtoken · helmet · IFrame Player API de YouTube

## Licencia

MIT