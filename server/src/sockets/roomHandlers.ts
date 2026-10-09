import { Server, Socket } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import { socketRooms } from './index';

const prisma = new PrismaClient();

export function handleRoomEvents(io: Server, socket: Socket) {
  // Join a room
  socket.on('room:join', async (data: { roomId: string }) => {
    const { roomId } = data;
    const userId = socket.data.userId;

    // Verify user is participant
    const participant = await prisma.roomParticipant.findFirst({
      where: { roomId, userId, leftAt: null },
    });

    if (!participant) {
      socket.emit('room:error', { message: 'No eres participante de esta sala' });
      return;
    }

    socket.join(`room:${roomId}`);
    socketRooms.set(socket.id, roomId);

    // Notify others
    socket.to(`room:${roomId}`).emit('room:userJoined', {
      userId: socket.data.userId,
      username: socket.data.username,
    });

    // Send current participants to the new user
    const participants = await prisma.roomParticipant.findMany({
      where: { roomId, leftAt: null },
      include: { user: { select: { id: true, username: true, avatarUrl: true } } },
    });

    socket.emit('room:participants', { participants });
  });

  // Leave a room
  socket.on('room:leave', async (data: { roomId: string }) => {
    const { roomId } = data;
    const userId = socket.data.userId;

    await prisma.roomParticipant.updateMany({
      where: { roomId, userId, leftAt: null },
      data: { leftAt: new Date() },
    });

    socket.leave(`room:${roomId}`);
    socketRooms.delete(socket.id);

    socket.to(`room:${roomId}`).emit('room:userLeft', {
      userId: socket.data.userId,
      username: socket.data.username,
    });
  });

  // Close room (host only)
  socket.on('room:close', async (data: { roomId: string }) => {
    const { roomId } = data;
    const userId = socket.data.userId;

    const room = await prisma.room.findUnique({ where: { id: roomId } });

    if (!room || room.hostId !== userId) {
      socket.emit('room:error', { message: 'Solo el anfitrión puede cerrar la sala' });
      return;
    }

    await prisma.room.update({
      where: { id: roomId },
      data: { status: 'closed', closedAt: new Date() },
    });

    io.to(`room:${roomId}`).emit('room:closed', {
      message: 'La sala ha sido cerrada por el anfitrión',
    });
  });

  // Set room video (host only)
  socket.on('room:setVideo', async (data: { roomId: string; videoId: string }) => {
    const { roomId, videoId } = data;
    const userId = socket.data.userId;

    const room = await prisma.room.findUnique({ where: { id: roomId } });

    if (!room || room.hostId !== userId) {
      socket.emit('room:error', { message: 'Solo el anfitrión puede cambiar el video' });
      return;
    }

    await prisma.room.update({
      where: { id: roomId },
      data: { videoId },
    });

    io.to(`room:${roomId}`).emit('room:videoChanged', { videoId });
  });
}
