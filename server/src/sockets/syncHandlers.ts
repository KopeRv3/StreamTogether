import { Server, Socket } from 'socket.io';
import { roomStates, socketRooms } from './index';

export function handleSyncEvents(io: Server, socket: Socket) {
  // Host sends sync event (play, pause, seek)
  socket.on('sync:event', (data: {
    roomId: string;
    type: 'play' | 'pause' | 'seek';
    position: number;
  }) => {
    const { roomId, type, position } = data;
    const userId = socket.data.userId;

    // Verify user is host
    // In production, check from database
    // For now, we trust the client (MVP)

    const serverTime = Date.now();

    // Update room state
    roomStates.set(roomId, {
      position,
      playing: type === 'play',
      timestamp: serverTime,
      videoId: roomStates.get(roomId)?.videoId || null,
    });

    // Broadcast to all other participants in the room
    socket.to(`room:${roomId}`).emit('sync:event', {
      type,
      position,
      serverTime,
    });
  });

  // Participant requests current sync state
  socket.on('sync:requestState', (data: { roomId: string }) => {
    const { roomId } = data;
    const state = roomStates.get(roomId);

    if (state) {
      socket.emit('sync:state', state);
    } else {
      socket.emit('sync:state', {
        position: 0,
        playing: false,
        timestamp: Date.now(),
        videoId: null,
      });
    }
  });

  // Host updates video ID
  socket.on('sync:setVideoId', (data: { roomId: string; videoId: string }) => {
    const { roomId, videoId } = data;
    const currentState = roomStates.get(roomId) || {
      position: 0,
      playing: false,
      timestamp: Date.now(),
      videoId: null,
    };

    currentState.videoId = videoId;
    roomStates.set(roomId, currentState);
  });

  // Heartbeat from host (periodic sync)
  socket.on('sync:heartbeat', (data: {
    roomId: string;
    position: number;
    playing: boolean;
  }) => {
    const { roomId, position, playing } = data;
    const serverTime = Date.now();

    roomStates.set(roomId, {
      position,
      playing,
      timestamp: serverTime,
      videoId: roomStates.get(roomId)?.videoId || null,
    });

    socket.to(`room:${roomId}`).emit('sync:heartbeat', {
      position,
      playing,
      serverTime,
    });
  });
}