# Traspaso: StreamTogether

Documento de estado para continuar el despliegue. Todo lo que sigue está
verificado contra el estado real del sistema al momento de escribirlo.

---

## 1. Dónde está el proyecto

```
Ruta local:    C:\Proyectos\RandomProjects
Repositorio:   https://github.com/KopeRv3/StreamTogether
Rama activa:   main (limpio salvo 3 archivos, ver §7)
Último commit: 3460b48 "Build segun entorno: Railway compila solo el backend"
```

Monorepo con backend y frontend separados:

```
streamtogether/
├── server/     Node + Express + Socket.IO + Prisma + PostgreSQL
│   ├── src/routes/       endpoints REST
│   ├── src/services/     lógica de negocio
│   ├── src/sockets/      eventos en tiempo real
│   ├── src/middleware/   auth, rate limiting, CORS, errores
│   ├── prisma/           esquema + migraciones
│   ├── railway.json      configuración de despliegue de Railway
│   └── railway.json      NO existe en la raíz (se borró a propósito)
├── web/        React 18 + Vite + Tailwind + Zustand
├── tests/      suites end-to-end (.mjs)
└── scripts/    utilidades de build y despliegue (.js)
```

---

## 2. Estado del código: TERMINADO

| | |
|---|---|
| Compila backend y frontend | ✅ |
| Pruebas | ✅ **243 en verde** |
| Migraciones | ✅ versionadas, `prisma/migrations/` |
| Documentación | ✅ README.md, DEPLOY.md, CONTRIBUTING.md, ARQUITECTURA.md |

Comandos:

```bash
npm run verify      # lint + formato + tipos + tests + build
npm test            # 94 pruebas unitarias
npm run test:all    # suite completa con backend limpio
npm run dev         # backend + frontend a la vez
```

Requisitos: Node 22+, npm, y PostgreSQL corriendo (ya está instalado, servicio
`postgresql-x64-17` en estado Running).

Postgres local: `postgresql://streamtogether:streamtogether@localhost:5432/streamtogether`

Celular en la misma red: `http://192.168.1.12:5173`

---

## 3. Funcionalidad

- **Entrar solo con nombre de usuario.** Sin correo, sin contraseña, sin
  registro. Endpoint `POST /api/auth/guest`. Si el nombre ya existe se
  reutiliza esa identidad.
- **YouTube.** Se pega una URL (`watch?v=`, `youtu.be`, `embed`, `shorts`,
  `live`) y el video se reproduce dentro de la app, sincronizado entre
  participantes. Usa la IFrame Player API porque un `<iframe>` normal no
  permite leer ni escribir `currentTime`.
- **Sincronización en tiempo real.** El anfitrión manda play/pause/seek y un
  latido cada 5 s; los participantes corrigen su posición con corrección de
  deriva de reloj.
- **Interfaz para celular.** Pestañas Video / Chat / Personas, navegación
  inferior, inputs de 16 px para que iOS no haga zoom.
- **Biblioteca** con videos de YouTube y subida de archivos.

---

## 4. Cuentas: YA AUTORIZADAS

No hace falta volver a iniciar sesión en ninguna de estas.

| Servicio | Usuario | Cómo |
|---|---|---|
| GitHub | `KopeRv3` | `gh auth status` |
| Railway | `DenzelGuti` | `railway whoami` |
| Vercel | cuenta de GitHub | `vercel whoami` |
| Git (credenciales) | — | `git config --global credential.helper` |

Tokens almacenados en el keyring del sistema. `gh auth refresh -s workflow`
queda **pendiente**: hace falta para poder subir `.github/workflows/ci.yml`,
que GitHub rechaza sin ese scope. Ese archivo está en el disco pero fuera
del historial de git a propósito.

---

## 5. Despliegue: QUEDA EL BACKEND

### 5.1 Vercel — HECHO ✅

```
https://web-ochre-mu-92.vercel.app
```

Proyecto `web`, desplegado con `VITE_API_URL` apuntando al backend de
Railway. **No funciona todavía** porque el backend no está arriba.

### 5.2 Railway — FALLANDO ❌

```
Proyecto:    streamtogether
ID:          3df28c5a-007e-4b60-9fc1-c2ca0b809ffc
Servicio DB: Postgres  (online)
Servicio:    api        (Failed)
Dominio:     https://api-production-95bf.up.railway.app
```

Configuración del servicio `api`, ya cargada:

```
NODE_ENV=production
JWT_EXPIRES_IN=30d
JWT_SECRET=<64 chars aleatorios>
CLIENT_URL=http://localhost:5173     ← FALTA CAMBIAR por el dominio de Vercel
UPLOAD_DIR=/tmp/uploads
MAX_FILE_SIZE=524288000
DATABASE_URL=postgresql://postgres:****@postgres.railway.internal:5432/railway
```

**El error actual:**

```
Deploy failed: Failed to snapshot repository. Please try again in a few minutes.
```

Este error **no viene del proyecto**. Railway ni siquiera logra tomar una
copia del repositorio: falla antes de construir. El mensaje pide reintentar,
lo que apunta a una incidencia de la plataforma.

Cómo consultar el estado:

```bash
cd C:\Proyectos\RandomProjects\server
railway status
railway up -c          # -c muestra el build en el mismo proceso
```

> **Nota:** `railway.json` vive en `server/`, no en la raíz. El directorio
> `server/` está enlazado al proyecto con `railway link`, y desde ahí
> `railway up` despliega solo el backend. Si se ejecuta desde la raíz, se
> sube todo el monorepo y el servicio enlazado a GitHub redespliega desde
> la raíz, lo que rompe el build (ver §6, error 4).

---

## 6. Errores ya encontrados y resueltos

**No repetirlos.** Todos están corregidos y verificados.

### Error 1 — `disks are not supported for free tier services`
El `render.yaml` pedía un disco persistente. El plan gratis no lo permite.
→ Se quitó el disco.

### Error 2 — `docker-entrypoint.sh` con CRLF
Windows guardó el script con finales de línea Windows. `/bin/sh` lee un
`\r` en cada comando y el script moría.
→ Se normalizó a LF, se agregó `.gitattributes` y se puso
`core.autocrlf=false`, que era la causa de fondo.

### Error 3 — `Prisma failed to detect the libssl/openssl version`
El motor de Prisma es un binario nativo y no corre en Alpine (musl, sin
OpenSSL).
→ Se cambió `node:22-alpine` por `node:22-slim` (Debian).

### Error 4 — `prisma: not found` en el build
Nixpacks construye desde la raíz del repo, donde el `package.json` es el
orquestador del monorepo y su script `build` compila también el frontend,
donde no hay dependencias de servidor instaladas.
→ `scripts/build.js` detecta `RAILWAY_ENVIRONMENT` y en Railway compila
solo el backend, instalando antes `server/`.

### Error 5 — `npm error code EALLOWSCRIPTS` ⭐
**El más importante y el que estaba debajo de todo lo demás.** npm 11 ya no
ejecuta scripts de instalación sin autorización explícita, así que
`npm ci` fallaba en `server/` y `web/`. Como tanto Render como Railway
ejecutan `npm ci` durante el build, **ninguna plataforma podía construir**.

→ Se agregó el campo `allowScripts` en ambos `package.json`, generado por
`node scripts/agregar-allow-scripts.js [carpeta]`, que lee la lista del
`package-lock.json`. Si cambian las dependencias hay que volver a correrlo.

Paquetes autorizados: `@prisma/client`, `@prisma/engines`, `prisma`,
`esbuild`, `fsevents`.

### Error 6 — Desplegar el backend dentro del servicio de la base de datos
`railway up` sin `--service` iba al servicio `Postgres` porque era el único
que existía. Se creó el servicio `api` con `railway add --service api`.

### Error 7 — `DATABASE_URL` como referencia sin resolver
`${{Postgres.DATABASE_URL}}` no se resolvía. Se fijó la URL explícita
construida con los parámetros de conexión del plugin Postgres.

---

## 7. Archivos sin commitear

```
D  railway.json          (raíz) — borrado a propósito, ya no aplica
M  web/.gitignore
?? .github/              (workflows/ci.yml) — pendiente del scope workflow
```

`web/.gitignore` merece revisión antes de commitear.

---

## 8. Pasos siguientes, en orden

**1. Reintentar Railway.** El error pide reintentar en minutos. Si Railway
sigue igual, es incidencia de plataforma y conviene esperar unas horas.

```bash
cd C:\Proyectos\RandomProjects\server
railway up -c
```

**2. Cuando el backend responda**, confirmar:

```bash
curl https://api-production-95bf.up.railway.app/api/health
# esperado: {"status":"ok",...}
```

**3. Corregir el CORS del backend.** En Railway, Environment del servicio
`api`, cambiar `CLIENT_URL` de `http://localhost:5173` a
`https://web-ochre-mu-92.vercel.app`. Si no, el navegador bloqueará las
peticiones con `Origen no permitido por CORS`.

**4. Redesplegar y probar** desde el navegador y desde el celular.

**5. Opcional — CI.** `gh auth refresh -h github.com -s workflow`, después
`git add .github && git commit && git push`.

---

## 9. Advertencias conocidas

- **`CLIENT_URL` está mal puesto** (apunta a localhost). Es el paso 3.
- **Sin contraseña no hay identidad real.** Cualquiera puede entrar con el
  nombre de otro. Es una decisión consciente del usuario, no un bug.
- **El estado de sincronización está en memoria.** Con más de una instancia
  del backend las salas se desincronizan. Marcado en
  `server/src/sockets/syncHandlers.ts` (el `Map` `states`) y en
  `server/src/middleware/rateLimit.ts` (el `Map` `buckets`).
- **`uploads/` en disco local** se pierde al reiniciar. Para producción,
  almacenamiento externo o quedarse solo con YouTube.
- **Railway pide tarjeta** tras agotar el crédito de prueba.
- **Docker se descartó** por cinco fallos seguidos. El `Dockerfile` sigue en
  el repo, ya arreglado y sin usar por Railway.

---

## 10. Un consejo sobre el método

En Render se Lostdoing cinco intentos porque se intentó arreglar a ciegas en
lugar de pedir el log del despliegue desde el primer intento. El log
mostraba la causa exacta en la primera línea.

**Con Railway sí se puede ver el log desde la CLI**, que es la diferencia
principal con Render:

```bash
railway up -c                              # build en vivo
railway logs --build --lines 80            # log del build
```

`railway logs` solo devuelve salida con un despliegue activo; sin eso dice
`Deployment does not have an associated build`. Con `-c` el build se
imprime en el mismo proceso y no hay que perseguirlo con jobs en segundo
plano.
