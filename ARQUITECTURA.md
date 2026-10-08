# Arquitectura de la Aplicación de Streaming Social

## Contexto del Proyecto

- **Tipo:** Pasatiempo personal + amigos
- **Presupuesto:** $0 (solo servicios gratuitos)
- **Experiencia del desarrollador:** Principiante
- **Objetivo:** Aprender mientras se construye algo funcional

---

## Stack Tecnológico (Revisado)

### Frontend
| Tecnología | Por qué |
|------------|---------|
| **React 18 + Vite** | Más popular, más tutoriales, más fácil de aprender |
| **TypeScript** | Evita errores, mejor para aprender buenas prácticas |
| **Tailwind CSS** | Estilos rápidos sin escribir CSS complejo |
| **Zustand** | Estado global simple (menos boilerplate que Redux) |

### Backend
| Tecnología | Por qué |
|------------|---------|
| **Node.js + Express** | Más simple que Fastify, más documentación para principiantes |
| **TypeScript** | Mismo lenguaje que frontend |
| **Socket.IO** | WebSocket con reconexión automática, rooms nativos |
| **Prisma + SQLite** | Base de datos sin servidor separado, fácil de migrar a PostgreSQL después |

### Infraestructura (Gratuita)
| Servicio | Uso | Límite gratuito |
|----------|-----|-----------------|
| **Render** | Backend + Base de datos | 750 horas/mes (se duerme tras inactividad) |
| **Vercel** | Frontend | 100GB bandwidth/mes |
| **Cloudflare R2** | Almacenamiento de videos | 10GB/mes |
| **Cloudflare Stream** | Streaming de video | 1000 minutos/mes |

---

## Arquitectura Simplificada

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENTE                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   React     │  │  Socket.IO  │  │   Video Player      │ │
│  │   (UI)      │  │  Client     │  │   (HTML5 nativo)    │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      RENDER (Backend)                        │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  Express + Socket.IO                                    ││
│  │  - REST API (auth, rooms, videos)                       ││
│  │  - WebSocket (sync, chat)                               ││
│  │  - SQLite (Prisma)                                      ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    CLOUDFLARE R2 (Videos)                    │
│  - Almacenamiento de archivos MP4                           │
│  - CDN integrado                                            │
└─────────────────────────────────────────────────────────────┘
```

---

## Estructura del Proyecto

```
random-projects/
├── package.json                 # Workspace root
├── .env.example                 # Variables de entorno ejemplo
├── .gitignore
├── README.md
│
├── apps/
│   ├── web/                     # Frontend React
│   │   ├── public/
│   │   ├── src/
│   │   │   ├── components/      # Componentes reutilizables
│   │   │   │   ├── ui/          # Botones, inputs, modales
│   │   │   │   ├── room/        # Componentes de sala
│   │   │   │   └── video/       # Player y controles
│   │   │   ├── pages/           # Páginas principales
│   │   │   │   ├── Login.tsx
│   │   │   │   ├── Register.tsx
│   │   │   │   ├── Home.tsx
│   │   │   │   └── Room.tsx
│   │   │   ├── hooks/           # Custom hooks
│   │   │   │   ├── useAuth.ts
│   │   │   │   ├── useSocket.ts
│   │   │   │   └── useVideoSync.ts
│   │   │   ├── stores/          # Estado global (Zustand)
│   │   │   │   ├── authStore.ts
│   │   │   │   └── roomStore.ts
│   │   │   ├── lib/             # Utilidades
│   │   │   │   ├── api.ts       # Cliente HTTP
│   │   │   │   └── socket.ts    # Configuración Socket.IO
│   │   │   ├── types/           # Tipos TypeScript
│   │   │   │   └── index.ts
│   │   │   ├── App.tsx
│   │   │   ├── main.tsx
│   │   │   └── index.css
│   │   ├── index.html
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── tailwind.config.js
│   │   └── vite.config.ts
│   │
│   └── server/                  # Backend Node.js
│       ├── prisma/
│       │   └── schema.prisma    # Definición de base de datos
│       ├── src/
│       │   ├── index.ts         # Punto de entrada
│       │   ├── config.ts        # Configuración
│       │   ├── middleware/      # Auth, errores
│       │   │   ├── auth.ts
│       │   │   └── errorHandler.ts
│       │   ├── routes/          # Endpoints REST
│       │   │   ├── auth.ts
│       │   │   ├── rooms.ts
│       │   │   └── videos.ts
│       │   ├── sockets/         # Handlers WebSocket
│       │   │   ├── index.ts
│       │   │   ├── roomHandlers.ts
│       │   │   ├── syncHandlers.ts
│       │   │   └── chatHandlers.ts
│       │   ├── services/        # Lógica de negocio
│       │   │   ├── authService.ts
│       │   │   ├── roomService.ts
│       │   │   └── videoService.ts
│       │   └── utils/           # Utilidades
│       │       ├── jwt.ts
│       │       └── codeGenerator.ts
│       ├── package.json
│       └── tsconfig.json
│
└── packages/
    └── shared/                  # Tipos compartidos
        └── types/
            └── index.ts
```

---

## Base de Datos (SQLite)

```sql
-- Usuarios
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  avatar_url TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Videos
CREATE TABLE videos (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  duration INTEGER NOT NULL,
  thumbnail_url TEXT,
  video_url TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT (datetime('now'))
);

-- Salas
CREATE TABLE rooms (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  host_id TEXT NOT NULL REFERENCES users(id),
  video_id TEXT REFERENCES videos(id),
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT (datetime('now')),
  closed_at TEXT
);

-- Participantes
CREATE TABLE room_participants (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  role TEXT DEFAULT 'participant',
  joined_at TEXT DEFAULT (datetime('now')),
  left_at TEXT
);

-- Mensajes de chat
CREATE TABLE chat_messages (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
```

---

## Sincronización de Video (Simplificada)

### Estrategia: "Anfitrión como Maestro"

1. **Anfitrión** controla el player y envía eventos con timestamp del servidor
2. **Servidor** guarda estado en memoria (Map) y hace broadcast
3. **Participantes** reciben eventos y ajustan su player
4. **Heartbeat** cada 5 segundos para corrección de drift

### Flujo de Eventos

```
Anfitrión: play @ 120s
    ↓
Servidor: guarda { position: 120, playing: true, timestamp: 1696000000000 }
    ↓
Broadcast a participantes
    ↓
Participante: recibe evento, calcula delay, ajusta player a 120 + delay
```

---

## Plan de Desarrollo

### Fase 1: Setup (Día 1)
- [ ] Inicializar proyecto con pnpm workspaces
- [ ] Configurar frontend (Vite + React + Tailwind)
- [ ] Configurar backend (Express + TypeScript)
- [ ] Configurar Prisma + SQLite
- [ ] Variables de entorno

### Fase 2: Autenticación (Día 2)
- [ ] Registro de usuarios
- [ ] Login con JWT
- [ ] Middleware de autenticación
- [ ] Proteger rutas

### Fase 3: Salas (Día 3-4)
- [ ] Crear sala con código único
- [ ] Unirse a sala por código
- [ ] Ver participantes
- [ ] Abandonar sala
- [ ] Cerrar sala (anfitrión)

### Fase 4: Video (Día 5-6)
- [ ] Subir videos (admin)
- [ ] Listar videos disponibles
- [ ] Seleccionar video en sala
- [ ] Player de video sincronizado

### Fase 5: Sincronización (Día 7-8)
- [ ] Eventos de play/pause/seek
- [ ] Heartbeat periódico
- [ ] Corrección de drift
- [ ] Sincronización al unirse

### Fase 6: Chat (Día 9)
- [ ] Enviar mensajes
- [ ] Recibir mensajes en tiempo real
- [ ] Historial de mensajes
- [ ] Indicador "escribiendo..."

### Fase 7: Pulido (Día 10)
- [ ] Diseño responsive
- [ ] Manejo de errores
- [ ] Estados de carga
- [ ] Deploy

---

## Decisiones Pendientes

1. **¿Quieres que use pnpm workspaces o prefieres dos proyectos separados?**
   - Workspaces: más profesional, un solo repo
   - Separados: más simple, más fácil de entender

2. **¿Para los videos de prueba, prefieres que:**
   - A) Deje el sistema de upload listo y tú subas videos después
   - B) Use videos de muestra de dominio público (Pexels, etc.)

3. **¿El deploy inicial lo hago en Render (gratuito) o prefieres local primero?**

---

*Documento actualizado: 2026-09-29*
*Versión: 2.0 - Ajustado a requerimientos del usuario*