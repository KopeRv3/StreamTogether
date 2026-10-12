import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import helmet from 'helmet';
import path from 'path';
import fs from 'fs';
import { config } from './config';
import { authRouter } from './routes/auth';
import { roomsRouter } from './routes/rooms';
import { videosRouter } from './routes/videos';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { corsMiddleware, esOrigenLocal } from './middleware/cors';
import { apiLimiter } from './middleware/rateLimit';
import { setupSocketHandlers } from './sockets';

const app = express();
const httpServer = createServer(app);

// En producción solo se acepta CLIENT_URL. En desarrollo se añaden los
// orígenes de la red local para poder probar desde el celular.
const esProduccion = config.nodeEnv === 'production';

const allowedOrigins = config.clientUrl
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

// Cabeceras de seguridad. El CSP se deja relajado porque el player de
// YouTube necesita cargar scripts y frames de youtube-nocookie.com.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }),
);

app.use(corsMiddleware(allowedOrigins, esProduccion));

// Límite global de peticiones
app.use('/api', apiLimiter);

// Límite de tamaño del body: 1 MB es suficiente para toda la API
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Sube videos con control de rango (seek) y caché
const uploadsDir = path.resolve(config.uploadDir);
fs.mkdirSync(uploadsDir, { recursive: true });

app.use(
  '/uploads',
  express.static(uploadsDir, {
    // Necesario para que el <video> pueda saltar a cualquier punto
    acceptRanges: true,
    maxAge: '7d',
  }),
);

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/rooms', roomsRouter);
app.use('/api/videos', videosRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 para rutas de API inexistentes (debe ir antes del error handler)
app.use('/api', notFoundHandler);

// Error handling: siempre el ultimo
app.use(errorHandler);

/** Mismo criterio de origen que la API, reutilizado por Socket.IO. */
function origenPermitido(origin: string | undefined): boolean {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  return !esProduccion && esOrigenLocal(origin);
}

/**
 * Socket.IO delega en el paquete `cors`, y ese paquete, cuando `origin` es
 * una funcion, la llama como `origin(origin, callback)` y espera que el
 * callback reciba la decision. Si solo se devuelve un booleano el callback
 * nunca se invoca y la peticion queda colgada indefinidamente: ni respuesta
 * ni error. Por eso aqui se envuelve la comprobacion en un callback.
 *
 * Pasar `false` no es un error de CORS: `cors` lo interpreta como "no
 * permitido", omite la cabecera Access-Control-Allow-Origin y deja que el
 * navegador bloquee la respuesta, que es justo lo que ya hacia la API.
 */
function origenPermitidoCors(
  origin: string | undefined,
  callback: (err: Error | null, permitido?: boolean) => void,
): void {
  callback(null, origenPermitido(origin));
}

const io = new Server(httpServer, {
  cors: {
    origin: origenPermitidoCors,
    credentials: true,
  },
  // En redes moviles el ping por defecto es corto y la conexion se cae
  pingTimeout: 25000,
  pingInterval: 20000,
});

setupSocketHandlers(io);

const server = httpServer.listen(config.port, () => {
  console.log(`[server] escuchando en http://localhost:${config.port}`);
  console.log(`[server] entorno: ${config.nodeEnv}`);
  console.log(`[server] origenes permitidos: ${allowedOrigins.join(', ') || 'ninguno'}`);
});

// Un throw asincrono sin capturar tumba el proceso entero. Este handler
// registra el error, deja constancia y apaga con codigo distinto de cero
// para que el orquestador reinicie el contenedor.
process.on('unhandledRejection', (reason) => {
  console.error('[fatal] promesa rechazada sin manejar:', reason);
  shutdown('unhandledRejection');
});

process.on('uncaughtException', (error) => {
  console.error('[fatal] excepcion sin capturar:', error);
  shutdown('uncaughtException');
});

// Apagado ordenado: cierra sockets y servidor antes de salir
function shutdown(signal: string) {
  console.log(`[server] ${signal} recibido, cerrando...`);

  io.close(() => {
    server.close(() => {
      console.log('[server] cerrado limpiamente');
      process.exit(0);
    });
  });

  // Red de seguridad por si algo se queda colgado
  setTimeout(() => process.exit(1), 8000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
