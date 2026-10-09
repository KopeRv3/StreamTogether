# Guia de contribucion

## Requisitos

- Node.js 22 o superior
- Docker (opcional, solo para el entorno completo)
- npm

## Primer arranque

```bash
npm run setup
```

Ese comando instala dependencias, aplica migraciones y siembra datos de prueba.
Levanta el frontend en http://localhost:5173 con las credenciales `ana / demo1234`.

## Flujo de trabajo

```bash
# 1. Crear una rama
git switch -c mi-cambio

# 2. Escribir codigo, y validar antes de hacer commit
npm run verify

# 3. Commit
git add .
git commit -m "descripcion clara de lo que cambia y por que"

# 4. Abrir un Pull Request
gh pr create
```

## Comandos

| Comando | Que hace |
|---|---|
| `npm run dev` | Levanta backend y frontend a la vez |
| `npm run verify` | Lint + formato + tipos + tests + build |
| `npm test` | Tests unitarios de ambos proyectos |
| `npm run test:all` | Suite completa con backend limpio |
| `npm run lint:fix` | Corrige lo que se puede corregir solo |
| `npm run format` | Aplica Prettier |
| `npm run build` | Compila backend y frontend |
| `npm run docker:up` | Postgres + backend + frontend en contenedores |

## Pruebas

Hay tres niveles, y todos se ejecutan en CI:

**Unitarios** (`npm test`) — lógica pura sin red ni base de datos:
extracción de IDs de YouTube, validación de entrada, sincronización de reloj,
códigos de sala.

```bash
npm --prefix server test -- --watch
npm --prefix web test -- --watch
```

**Flujo** (`npm run test:flow`) — 71 comprobaciones contra un backend real:
registro, salas, videos de YouTube, control de acceso, sincronización por
WebSocket y rate limiting.

**Robustez** (`npm run test:resilience`) — 35 comprobaciones de que el
servidor nunca muere: JSON malformado, valores extremos, rutas raras,
cabeceras ausentes y 60 peticiones simultáneas.

```bash
npm run test:all     # levanta y detiene el backend por ti
```

## Convenciones

**El servidor es la frontera de confianza.** Aunque el frontend valide, el
backend vuelve a comprobar. Nunca confíes en lo que llega del cliente.

**Toda ruta async va envuelta en `asyncHandler`.** Express 4 no captura
rechazos de promesa: sin el wrapper, un `await` que falla deja la petición
colgada o tumba el proceso.

```ts
// Correcto
roomsRouter.get('/:id', authMiddleware, asyncHandler(async (req, res) => {
  const room = await getRoomState(req.params.id, req.userId!);
  res.json({ room });
}));
```

**Validar con `utils/validation.ts`.** Los validadores lanzan `AppError` con
el código HTTP y el mensaje en español, así que el `errorHandler` los traduce
sin try/catch en cada endpoint.

**Nada sensible en el repositorio.** `.env`, la base de datos, `uploads/` y los
logs están en `.gitignore`. Si agregas una variable, actualiza también el
`.env.example` correspondiente.

**Mensajes de error en español, sin acentos en el código.** Los comentarios
y los mensajes al usuario van en español; los identificadores en inglés.

## Antes de abrir un Pull Request

```bash
npm run verify
```

Si toca la parte de tiempo real, hay que probar con **dos navegadores**:
uno como anfitrión y otro como participante. Comprueba play, pause, seek y
que la deriva no sea visible.

Si toca el despliegue, actualiza `DEPLOY.md`.

## Dónde tocar cosas

| Necesito cambiar... | Archivo |
|---|---|
| Un endpoint | `server/src/routes/` |
| Reglas de negocio | `server/src/services/` |
| Eventos en tiempo real | `server/src/sockets/` |
| Autenticación o límites | `server/src/middleware/` |
| Validación de entrada | `server/src/utils/validation.ts` |
| Extracción de URLs de YouTube | `server/src/utils/youtube.ts` y `web/src/lib/youtube.ts` (mantener en sincronía) |
| Sincronización del player | `web/src/hooks/useMediaSync.ts` |
| Corrección de reloj | `web/src/lib/clockSync.ts` |
| El esquema de la base | `server/prisma/schema.prisma` + una migración nueva |