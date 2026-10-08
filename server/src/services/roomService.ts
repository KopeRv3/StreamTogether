import { PrismaClient } from '@prisma/client';
import { generateRoomCode } from '../utils/codeGenerator';
import { AppError } from '../middleware/errorHandler';

const prisma = new PrismaClient();

export async function createRoom(hostId: string) {
  let code: string;
  let attempts = 0;

  do {
    code = generateRoomCode(6);
    const existing = await prisma.room.findUnique({ where: { code } });
    if (!existing) break;
    attempts++;
  } while (attempts < 10);

  const room = await prisma.room.create({
    data: {
      code,
      hostId,
      participants: {
        create: { userId: hostId, role: 'host' },
      },
    },
    include: {
      host: { select: { id: true, username: true, avatarUrl: true } },
      participants: {
        include: { user: { select: { id: true, username: true, avatarUrl: true } } },
      },
    },
  });

  return room;
}

export async function joinRoom(code: string, userId: string) {
  const room = await prisma.room.findUnique({
    where: { code },
    include: {
      host: { select: { id: true, username: true, avatarUrl: true } },
      video: true,
      participants: {
        include: { user: { select: { id: true, username: true, avatarUrl: true } } },
      },
    },
  });

  if (!room) {
    throw new AppError('Sala no encontrada', 404);
  }

  if (room.status !== 'active') {
    throw new AppError('La sala ha sido cerrada', 400);
  }

  const existingParticipant = room.participants.find(p => p.userId === userId);

  if (existingParticipant && !existingParticipant.leftAt) {
    return { room, alreadyJoined: true };
  }

  if (existingParticipant && existingParticipant.leftAt) {
    await prisma.roomParticipant.update({
      where: { id: existingParticipant.id },
      data: { leftAt: null, joinedAt: new Date() },
    });
  } else {
    await prisma.roomParticipant.create({
      data: { roomId: room.id, userId, role: 'participant' },
    });
  }

  const updatedRoom = await prisma.room.findUnique({
    where: { code },
    include: {
      host: { select: { id: true, username: true, avatarUrl: true } },
      video: true,
      participants: {
        include: { user: { select: { id: true, username: true, avatarUrl: true } } },
      },
    },
  });

  return { room: updatedRoom, alreadyJoined: false };
}

export async function leaveRoom(roomId: string, userId: string) {
  const participant = await prisma.roomParticipant.findFirst({
    where: { roomId, userId, leftAt: null },
  });

  if (participant) {
    await prisma.roomParticipant.update({
      where: { id: participant.id },
      data: { leftAt: new Date() },
    });
  }

  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: { participants: { where: { leftAt: null } } },
  });

  if (room && room.participants.length === 0) {
    await prisma.room.update({
      where: { id: roomId },
      data: { status: 'closed', closedAt: new Date() },
    });
  }
}

export async function closeRoom(roomId: string, hostId: string) {
  const room = await prisma.room.findUnique({ where: { id: roomId } });

  if (!room) {
    throw new AppError('Sala no encontrada', 404);
  }

  if (room.hostId !== hostId) {
    throw new AppError('Solo el anfitrión puede cerrar la sala', 403);
  }

  await prisma.room.update({
    where: { id: roomId },
    data: { status: 'closed', closedAt: new Date() },
  });
}

export async function setRoomVideo(roomId: string, videoId: string, hostId: string) {
  const room = await prisma.room.findUnique({ where: { id: roomId } });

  if (!room) {
    throw new AppError('Sala no encontrada', 404);
  }

  if (room.hostId !== hostId) {
    throw new AppError('Solo el anfitrión puede cambiar el video', 403);
  }

  await prisma.room.update({
    where: { id: roomId },
    data: { videoId },
  });
}

export async function getRoomState(roomId: string) {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: {
      host: { select: { id: true, username: true, avatarUrl: true } },
      video: true,
      participants: {
        where: { leftAt: null },
        include: { user: { select: { id: true, username: true, avatarUrl: true } } },
      },
    },
  });

  if (!room) {
    throw new AppError('Sala no encontrada', 404);
  }

  return room;
}

export async function getRoomMessages(roomId: string, limit: number = 50) {
  return prisma.chatMessage.findMany({
    where: { roomId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { user: { select: { id: true, username: true, avatarUrl: true } } },
  });
}