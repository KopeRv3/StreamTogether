import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import { getAllVideos, createVideo, createYouTubeVideo, deleteVideo } from '../services/videoService';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';

export const videosRouter = Router();

const ALLOWED_EXTENSIONS = ['.mp4', '.webm', '.mov'];

// multer escribe directo a disco, por eso el directorio debe existir antes
fs.mkdirSync(path.resolve(config.uploadDir), { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.resolve(config.uploadDir));
  },
  filename: (_req, file, cb) => {
    // UUID + extensión sanitizada: nunca usamos el nombre original del archivo
    const ext = path.extname(file.originalname).toLowerCase().replace(/[^a-z0-9.]/g, '');
    cb(null, `${uuidv4()}${ALLOWED_EXTENSIONS.includes(ext) ? ext : '.mp4'}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: config.maxFileSize, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXTENSIONS.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos MP4, WebM o MOV'));
    }
  },
});

// Subir archivos es caro: límite más estricto que el resto de la API
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: 'Demasiadas subidas. Intenta de nuevo en un rato.',
});

// GET /api/videos - List all videos
videosRouter.get('/', authMiddleware, async (_req: AuthRequest, res: Response) => {
  try {
    const videos = await getAllVideos();
    res.json({ videos });
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Error interno' });
    }
  }
});

// POST /api/videos/youtube - Register a YouTube video from its URL
videosRouter.post('/youtube', authMiddleware, uploadLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const { url, title, description, duration } = req.body ?? {};

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'La URL de YouTube es requerida' });
    }

    const video = await createYouTubeVideo(
      url.trim().slice(0, 500),
      typeof title === 'string' ? title : null,
      typeof description === 'string' ? description : null,
      req.userId!,
      typeof duration === 'number' ? duration : parseInt(String(duration ?? '0'), 10) || 0,
    );

    res.status(201).json({ video });
  } catch (error) {
    if (error instanceof Error) {
      const status = (error as { statusCode?: number }).statusCode ?? 400;
      res.status(status).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Error interno' });
    }
  }
});

// POST /api/videos - Upload a new video file
videosRouter.post(
  '/',
  authMiddleware,
  uploadLimiter,
  upload.single('video'),
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Archivo de video requerido' });
      }

      const { title, description, duration } = req.body;

      if (!title || !title.trim()) {
        return res.status(400).json({ error: 'El título es requerido' });
      }

      const parsedDuration = parseInt(String(duration ?? ''), 10);

      if (!Number.isFinite(parsedDuration) || parsedDuration <= 0) {
        return res.status(400).json({ error: 'La duración debe ser un número positivo' });
      }

      const video = await createVideo(
        req.file,
        title.trim().slice(0, 200),
        description?.trim() ? description.trim().slice(0, 2000) : null,
        parsedDuration,
        req.userId!,
      );

      res.status(201).json({ video });
    } catch (error) {
      if (error instanceof Error) {
        const status = (error as { statusCode?: number }).statusCode ?? 400;
        res.status(status).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Error interno' });
      }
    }
  },
);

// DELETE /api/videos/:id - Delete a video (owner only)
videosRouter.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await deleteVideo(req.params.id, req.userId!);
    res.json({ success: true });
  } catch (error) {
    if (error instanceof Error) {
      const status = (error as { statusCode?: number }).statusCode ?? 500;
      res.status(status).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Error interno' });
    }
  }
});