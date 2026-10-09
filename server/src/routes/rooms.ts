import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { roomLimiter } from '../middleware/rateLimit';
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

function fail(res: Response, error: unknown, fallbackStatus = 500) {
  if (error instanceof Error) {
    const status = (error as { statusCode?: number }).statusCode ?? fallbackStatus;
    return res.status(status).json({ error: error.message });
  }
  return res.status(500).json({ error: 'Error interno' });
}

// POST /api/rooms - Create a new room
roomsRouter.post('/', authMiddleware, roomLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const room = await createRoom(req.userId!);
    res.status(201).json({ room });
  } catch (error) {
    return fail(res, error);
  }
});

// POST /api/rooms/join - Join a room by code
roomsRouter.post('/join', authMiddleware, roomLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const { code } = req.body ?? {};

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Código de sala requerido' });
    }

    const result = await joinRoom(code.trim().toUpperCase().slice(0, 10), req.userId!);
    res.json(result);
  } catch (error) {
    return fail(res, error, 404);
  }
});

// POST /api/rooms/:id/leave - Leave a room
roomsRouter.post('/:id/leave', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await leaveRoom(req.params.id, req.userId!);
    res.json({ success: true });
  } catch (error) {
    return fail(res, error);
  }
});

// POST /api/rooms/:id/close - Close a room (host only)
roomsRouter.post('/:id/close', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await closeRoom(req.params.id, req.userId!);
    res.json({ success: true });
  } catch (error) {
    return fail(res, error, 403);
  }
});

// POST /api/rooms/:id/video - Set room video (host only)
roomsRouter.post('/:id/video', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { videoId } = req.body ?? {};

    if (!videoId || typeof videoId !== 'string') {
      return res.status(400).json({ error: 'videoId requerido' });
    }

    await setRoomVideo(req.params.id, videoId, req.userId!);
    res.json({ success: true });
  } catch (error) {
    return fail(res, error, 403);
  }
});

// GET /api/rooms/:id - Get room state (participantes únicamente)
roomsRouter.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const room = await getRoomState(req.params.id, req.userId!);
    res.json({ room });
  } catch (error) {
    return fail(res, error, 404);
  }
});

// GET /api/rooms/:id/messages - Get room chat history (participantes únicamente)
roomsRouter.get('/:id/messages', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const messages = await getRoomMessages(req.params.id, req.userId!, req.query.limit as string);
    res.json({ messages: messages.reverse() });
  } catch (error) {
    return fail(res, error);
  }
});