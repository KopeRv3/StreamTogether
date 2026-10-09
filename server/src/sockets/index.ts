import { Server, Socket } from 'socket.io';
import { verifyToken } from '../utils/jwt';
import { handleRoomEvents } from './roomHandlers';
import { handleSyncEvents } from './syncHandlers';
import { handleChatEvents } from './chatHandlers';

// In-memory room state for sync
export const roomStates = new Map<
  string,
  {
    position: number;
    playing: boolean;
    timestamp: number;
    videoId: string | null;
  }
>();

// Track which room each socket is in
export const socketRooms = new Map<string, string>();

export function setupSocketHandlers(io: Server) {
  // Authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error('Token requerido'));
    }

    const decoded = verifyToken(token);

    if (!decoded) {
      return next(new Error('Token inválido'));
    }

    socket.data.userId = decoded.userId;
    socket.data.username = decoded.username;
    next();
  });

  io.on('connection', (socket: Socket) => {
    console.log(`User connected: ${socket.data.username} (${socket.id})`);

    handleRoomEvents(io, socket);
    handleSyncEvents(io, socket);
    handleChatEvents(io, socket);

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.data.username} (${socket.id})`);
      const roomId = socketRooms.get(socket.id);
      if (roomId) {
        socket.leave(`room:${roomId}`);
        socketRooms.delete(socket.id);
        io.to(`room:${roomId}`).emit('room:userLeft', {
          userId: socket.data.userId,
          username: socket.data.username,
        });
      }
    });
  });
}
