# StreamTogether

Aplicación de streaming social donde dos o más personas pueden ver videos sincronizados mientras chatean en tiempo real.

## Estructura del Proyecto

```
random-projects/
├── web/          # Frontend (React + Vite + Tailwind)
└── server/       # Backend (Node.js + Express + Socket.IO)
```

## Requisitos Previos

- Node.js 18 o superior
- npm o pnpm

## Configuración Inicial

### 1. Backend

```bash
cd server

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env

# Generar cliente de Prisma
npm run db:generate

# Crear base de datos
npm run db:push

# Iniciar servidor de desarrollo
npm run dev
```

El servidor estará disponible en `http://localhost:3001`

### 2. Frontend

```bash
cd web

# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev
```

La aplicación estará disponible en `http://localhost:5173`

## Cómo Usar

1. **Regístrate** en la aplicación
2. **Crea una sala** desde la página principal
3. **Comparte el código** de 6 caracteres con tus amigos
4. **Selecciona un video** (el anfitrión controla la reproducción)
5. **Disfruta** del video sincronizado mientras chateas

## Subir Videos

Para subir videos de prueba:

1. Crea una carpeta `uploads/` en el directorio `server/`
2. Usa la API directamente o agrega un endpoint de administración
3. Formatos soportados: MP4, WebM, MOV
4. Tamaño máximo: 500MB

## Scripts Disponibles

### Backend
- `npm run dev` - Servidor de desarrollo con hot-reload
- `npm run build` - Compilar para producción
- `npm run start` - Iniciar servidor de producción
- `npm run db:generate` - Generar cliente de Prisma
- `npm run db:push` - Sincronizar esquema con base de datos
- `npm run db:studio` - Abrir Prisma Studio (GUI base de datos)

### Frontend
- `npm run dev` - Servidor de desarrollo
- `npm run build` - Compilar para producción
- `npm run preview` - Vista previa de producción

## Arquitectura

Ver [ARQUITECTURA.md](./ARQUITECTURA.md) para más detalles sobre las decisiones técnicas.

## Tecnologías

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Zustand
- **Backend:** Node.js, Express, TypeScript, Socket.IO, Prisma
- **Base de datos:** SQLite (desarrollo), PostgreSQL (producción futura)
- **Almacenamiento:** Sistema de archivos local (desarrollo), S3 (producción futura)

## Licencia

MIT