import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import {
  getAllVideos,
  createVideo,
  createYouTubeVideo,
  deleteVideo,
} from '../services/videoService';
import { extractYouTubeId } from '../utils/youtube';
import {
  validateTitle,
  validateDescription,
  validateDuration,
  assert,
  LIMITS,
} from '../utils/validation';
import { asyncHandler } from '../utils/asyncHandler';
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
    // UUID + extensión sanitizada: nunca usamos el nombre original
    const raw = path
      .extname(file.originalname)
      .toLowerCase()
      .replace(/[^a-z0-9.]/g, '');
    cb(null, `${uuidv4()}${ALLOWED_EXTENSIONS.includes(raw) ? raw : '.mp4'}`);
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

// Subir archivos es costoso: límite más estricto que el resto de la API
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: 'Demasiadas subidas. Intenta de nuevo en un rato.',
});

// GET /api/videos - Listar la biblioteca de videos
videosRouter.get(
  '/',
  authMiddleware,
  asyncHandler(async (_req, res) => {
    const videos = await getAllVideos();
    res.json({ videos });
  }),
);

// POST /api/videos/youtube - Registrar un video de YouTube a partir de su URL
videosRouter.post(
  '/youtube',
  authMiddleware,
  uploadLimiter,
  asyncHandler(async (req: AuthRequest, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;

    assert(
      typeof body.url === 'string' && body.url.trim(),
      'La URL de YouTube es requerida',
      'URL_REQUERIDA',
    );

    const url = body.url.trim();
    assert(url.length <= LIMITS.urlMax, 'La URL es demasiado larga', 'URL_LARGA');

    // Se valida aquí y no solo en el servicio para poder normalizar antes
    const youtubeId = extractYouTubeId(url);
    assert(
      youtubeId,
      'URL de YouTube no válida. Usa un enlace de watch, youtu.be, embed o shorts.',
      'URL_INVALIDA',
    );

    const video = await createYouTubeVideo(
      url,
      validateTitle(body.title),
      validateDescription(body.description),
      req.userId!,
    );

    res.status(201).json({ video });
  }),
);

// POST /api/videos - Subir un archivo de video
videosRouter.post(
  '/',
  authMiddleware,
  uploadLimiter,
  upload.single('video'),
  asyncHandler(async (req: AuthRequest, res) => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'Archivo de video requerido' });
      return;
    }

    const body = (req.body ?? {}) as Record<string, unknown>;

    const title = validateTitle(body.title, true);
    const description = validateDescription(body.description);
    const duration = validateDuration(body.duration);

    const video = await createVideo(file, title!, description, duration, req.userId!);
    res.status(201).json({ video });
  }),
);

// DELETE /api/videos/:id - Eliminar un video (solo su dueño)
videosRouter.delete(
  '/:id',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    await deleteVideo(req.params.id, req.userId!);
    res.json({ success: true });
  }),
);
