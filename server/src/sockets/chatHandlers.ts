import { Server, Socket } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import { isRoomParticipant } from '../services/roomService';

const prisma = new PrismaClient();

const MAX_LENGTH = 500;

export function handleChatEvents(io: Server, socket: Socket) {
  // Cachea la pertenencia por conexión: evita una query por cada pulsación
  // de "escribiendo", que sería una consulta constante a la base de datos.
  const membership = new Map<string, boolean>();

  socket.on('chat:message', async (data: { roomId: string; content: string }) => {
    const { roomId, content } = data ?? ({} as never);
    const userId = socket.data.userId as string;

    if (!roomId || typeof content !== 'string') return;

    const clean = content.trim();
    if (!clean) return;

    if (clean.length > MAX_LENGTH) {
      socket.emit('chat:error', {
        message: `Mensaje demasiado largo (máx ${MAX_LENGTH} caracteres)`,
      });
      return;
    }

    // Verifica pertenencia antes de escribir
    let allowed = membership.get(roomId);
    if (allowed === undefined) {
      allowed = await isRoomParticipant(roomId, userId);
      membership.set(roomId, allowed);
    }

    if (!allowed) {
      socket.emit('chat:error', { message: 'No tienes acceso a esta sala' });
      return;
    }

    let message;
    try {
      message = await prisma.chatMessage.create({
        data: { roomId, userId, content: clean },
        include: { user: { select: { id: true, username: true, avatarUrl: true } } },
      });
    } catch {
      socket.emit('chat:error', { message: 'No se pudo enviar el mensaje' });
      return;
    }

    io.to(`room:${roomId}`).emit('chat:message', message);
  });

  socket.on('chat:typing', async (data: { roomId: string; isTyping: boolean }) => {
    const { roomId, isTyping } = data ?? ({} as never);
    if (!roomId) return;

    let allowed = membership.get(roomId);
    if (allowed === undefined) {
      allowed = await isRoomParticipant(roomId, socket.data.userId as string);
      membership.set(roomId, allowed);
    }

    if (!allowed) return;

    socket.to(`room:${roomId}`).emit('chat:typing', {
      userId: socket.data.userId,
      username: socket.data.username,
      isTyping: !!isTyping,
    });
  });
}
