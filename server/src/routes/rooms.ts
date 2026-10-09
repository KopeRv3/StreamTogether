import { Router } from 'express';
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
import { validateRoomCode } from '../utils/validation';
import { asyncHandler } from '../utils/asyncHandler';

export const roomsRouter = Router();

// POST /api/rooms - Crear una sala nueva (el creador queda como anfitrión)
roomsRouter.post(
  '/',
  authMiddleware,
  roomLimiter,
  asyncHandler(async (req: AuthRequest, res) => {
    const room = await createRoom(req.userId!);
    res.status(201).json({ room });
  }),
);

// POST /api/rooms/join - Unirse con el código de invitación
roomsRouter.post(
  '/join',
  authMiddleware,
  roomLimiter,
  asyncHandler(async (req: AuthRequest, res) => {
    const code = validateRoomCode((req.body ?? {}).code);
    const result = await joinRoom(code, req.userId!);
    res.json(result);
  }),
);

// POST /api/rooms/:id/leave - Salir de la sala
roomsRouter.post(
  '/:id/leave',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    await leaveRoom(req.params.id, req.userId!);
    res.json({ success: true });
  }),
);

// POST /api/rooms/:id/close - Cerrar la sala (solo anfitrión)
roomsRouter.post(
  '/:id/close',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    await closeRoom(req.params.id, req.userId!);
    res.json({ success: true });
  }),
);

// POST /api/rooms/:id/video - Elegir el video de la sala (solo anfitrión)
roomsRouter.post(
  '/:id/video',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const videoId = (req.body ?? {}).videoId;

    if (typeof videoId !== 'string' || !videoId) {
      res.status(400).json({ error: 'videoId requerido' });
      return;
    }

    await setRoomVideo(req.params.id, videoId, req.userId!);
    res.json({ success: true });
  }),
);

// GET /api/rooms/:id - Estado de la sala (solo participantes)
roomsRouter.get(
  '/:id',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const room = await getRoomState(req.params.id, req.userId!);
    res.json({ room });
  }),
);

// GET /api/rooms/:id/messages - Historial del chat (solo participantes)
roomsRouter.get(
  '/:id/messages',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const messages = await getRoomMessages(req.params.id, req.userId!, req.query.limit as string);
    // getRoomMessages devuelve los más recientes primero; el chat los muestra
    // de más antiguo a más nuevo
    res.json({ messages: messages.reverse() });
  }),
);
