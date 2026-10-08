import { Server, Socket } from 'socket.io';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export function handleChatEvents(io: Server, socket: Socket) {
  // Send a chat message
  socket.on('chat:message', async (data: { roomId: string; content: string }) => {
    const { roomId, content } = data;
    const userId = socket.data.userId;

    if (!content || content.trim().length === 0) {
      return;
    }

    if (content.length > 500) {
      socket.emit('chat:error', { message: 'Mensaje demasiado largo (máx 500 caracteres)' });
      return;
    }

    // Save to database
    const message = await prisma.chatMessage.create({
      data: {
        roomId,
        userId,
        content: content.trim(),
      },
      include: {
        user: { select: { id: true, username: true, avatarUrl: true } },
      },
    });

    // Broadcast to room
    io.to(`room:${roomId}`).emit('chat:message', message);
  });

  // User is typing
  socket.on('chat:typing', (data: { roomId: string; isTyping: boolean }) => {
    const { roomId, isTyping } = data;

    socket.to(`room:${roomId}`).emit('chat:typing', {
      userId: socket.data.userId,
      username: socket.data.username,
      isTyping,
    });
  });
}