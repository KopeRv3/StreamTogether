import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import fs from 'fs';
import { config } from './config';
import { authRouter } from './routes/auth';
import { roomsRouter } from './routes/rooms';
import { videosRouter } from './routes/videos';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { apiLimiter } from './middleware/rateLimit';
import { setupSocketHandlers } from './sockets';

const app = express();
const httpServer = createServer(app);

// Solo acepta orígenes conocidos; en producción es la URL del frontend
const allowedOrigins = config.clientUrl
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const corsOptions = {
  origin(origin: string | undefined, callback: (err: Error | null, ok?: boolean) => void) {
    // Sin origin = curl, Postman, apps móviles → permitido
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`Origen no permitido por CORS: ${origin}`));
  },
  credentials: true,
};

// Cabeceras de seguridad. El CSP se deja relajado porque el player de
// YouTube necesita cargar scripts y frames de youtube-nocookie.com.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }),
);

app.use(cors(corsOptions));

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

// Socket.IO
const io = new Server(httpServer, {
  cors: { origin: allowedOrigins.length ? allowedOrigins : true, credentials: true },
  // Necesario para video largo: los mensajes de socket son pequeños,
  // pero el ping por defecto es corto en redes móviles
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
