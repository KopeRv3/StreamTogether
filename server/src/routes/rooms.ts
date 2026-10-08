import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import {
  createRoom,
  joinRoom,
  leaveRoom,
  closeRoom,
  setRoomVideo,
  getRoomState,
  getRoomMessages,
} from '../services/roomService';

export const roomsRouter = Router();

// POST /api/rooms - Create a new room
roomsRouter.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const room = await createRoom(req.userId!);
    res.status(201).json({ room });
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Error interno' });
    }
  }
});

// POST /api/rooms/join - Join a room by code
roomsRouter.post('/join', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Código de sala requerido' });
    }

    const result = await joinRoom(code.toUpperCase(), req.userId!);
    res.json(result);
  } catch (error) {
    if (error instanceof Error) {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Error interno' });
    }
  }
});

// POST /api/rooms/:id/leave - Leave a room
roomsRouter.post('/:id/leave', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await leaveRoom(req.params.id, req.userId!);
    res.json({ success: true });
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Error interno' });
    }
  }
});

// POST /api/rooms/:id/close - Close a room (host only)
roomsRouter.post('/:id/close', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await closeRoom(req.params.id, req.userId!);
    res.json({ success: true });
  } catch (error) {
    if (error instanceof Error) {
      res.status(403).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Error interno' });
    }
  }
});

// POST /api/rooms/:id/video - Set room video (host only)
roomsRouter.post('/:id/video', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { videoId } = req.body;

    if (!videoId) {
      return res.status(400).json({ error: 'videoId requerido' });
    }

    await setRoomVideo(req.params.id, videoId, req.userId!);
    res.json({ success: true });
  } catch (error) {
    if (error instanceof Error) {
      res.status(403).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Error interno' });
    }
  }
});

// GET /api/rooms/:id - Get room state
roomsRouter.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const room = await getRoomState(req.params.id);
    res.json({ room });
  } catch (error) {
    if (error instanceof Error) {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Error interno' });
    }
  }
});

// GET /api/rooms/:id/messages - Get room messages
roomsRouter.get('/:id/messages', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const messages = await getRoomMessages(req.params.id, limit);
    res.json({ messages: messages.reverse() });
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Error interno' });
    }
  }
});