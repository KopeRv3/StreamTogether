import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { getAllVideos, createVideo, deleteVideo } from '../services/videoService';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';

export const videosRouter = Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.resolve(config.uploadDir));
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: config.maxFileSize },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['.mp4', '.webm', '.mov'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos MP4, WebM o MOV'));
    }
  },
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

// POST /api/videos - Upload a new video
videosRouter.post(
  '/',
  authMiddleware,
  upload.single('video'),
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Archivo de video requerido' });
      }

      const { title, description, duration } = req.body;

      if (!title || !duration) {
        return res.status(400).json({ error: 'Title y duration son requeridos' });
      }

      const video = await createVideo(
        req.file,
        title,
        description || null,
        parseInt(duration)
      );

      res.status(201).json({ video });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Error interno' });
      }
    }
  }
);

// DELETE /api/videos/:id - Delete a video
videosRouter.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await deleteVideo(req.params.id);
    res.json({ success: true });
  } catch (error) {
    if (error instanceof Error) {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Error interno' });
    }
  }
});