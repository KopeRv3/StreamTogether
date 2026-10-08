import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { config } from './config';
import { authRouter } from './routes/auth';
import { roomsRouter } from './routes/rooms';
import { videosRouter } from './routes/videos';
import { errorHandler } from './middleware/errorHandler';
import { setupSocketHandlers } from './sockets';

const app = express();
const httpServer = createServer(app);

// CORS configuration
app.use(cors({
  origin: config.clientUrl,
  credentials: true,
}));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure uploads directory exists
const uploadsDir = path.resolve(config.uploadDir);
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve uploaded files statically
app.use('/uploads', express.static(uploadsDir));

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/rooms', roomsRouter);
app.use('/api/videos', videosRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling
app.use(errorHandler);

// Socket.IO setup
const io = new Server(httpServer, {
  cors: {
    origin: config.clientUrl,
    credentials: true,
  },
});

setupSocketHandlers(io);

// Start server
httpServer.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
  console.log(`Environment: ${config.nodeEnv}`);
});