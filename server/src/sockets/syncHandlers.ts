import { Server, Socket } from 'socket.io';
import { isRoomHost, isRoomParticipant } from '../services/roomService';

export interface SyncSnapshot {
  position: number;
  playing: boolean;
  timestamp: number;
  videoId: string | null;
}

/**
 * Estado de reproducción por sala.
 *
 * Nota de escalado: vive en memoria, así que solo es consistente dentro de
 * una misma instancia. Al desplegar en varias réplicas hay que mover esto a
 * Redis (Upstash) o a un servicio de pub/sub.
 */
const states = new Map<string, SyncSnapshot>();

export function getRoomSyncState(roomId: string): SyncSnapshot {
  return (
    states.get(roomId) ?? {
      position: 0,
      playing: false,
      timestamp: Date.now(),
      videoId: null,
    }
  );
}

function setRoomSyncState(roomId: string, patch: Partial<SyncSnapshot>): SyncSnapshot {
  const next: SyncSnapshot = { ...getRoomSyncState(roomId), ...patch };
  states.set(roomId, next);
  return next;
}

export function clearRoomSyncState(roomId: string) {
  states.delete(roomId);
}

const VALID_TYPES = new Set(['play', 'pause', 'seek']);

function isValidPosition(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

/**
 * Eventos de sincronización de reproducción.
 *
 * El anfitrión se verifica SIEMPRE contra la base de datos. Antes el código
 * confiaba en el cliente ("For now, we trust the client"), lo que permitía que
 * cualquier participante controlara la reproducción de los demás.
 */
export function handleSyncEvents(io: Server, socket: Socket) {
  socket.on(
    'sync:event',
    async (data: { roomId: string; type: 'play' | 'pause' | 'seek'; position: number }) => {
      const { roomId, type, position } = data ?? ({} as never);
      const userId = socket.data.userId as string;

      if (!roomId || typeof type !== 'string' || !VALID_TYPES.has(type)) return;
      if (!isValidPosition(position)) return;

      if (!(await isRoomHost(roomId, userId))) {
        socket.emit('sync:error', { message: 'Solo el anfitrión controla la reproducción' });
        return;
      }

      const serverTime = Date.now();
      const cleanPosition = Math.floor(position);

      setRoomSyncState(roomId, {
        position: cleanPosition,
        playing: type === 'play',
        timestamp: serverTime,
      });

      socket.to(`room:${roomId}`).emit('sync:event', {
        type,
        position: cleanPosition,
        serverTime,
      });
    },
  );

  // Cuando alguien entra, necesita conocer la posición actual del video
  socket.on('sync:requestState', async (data: { roomId: string }) => {
    const { roomId } = data ?? ({} as never);
    if (!roomId) return;

    if (!(await isRoomParticipant(roomId, socket.data.userId as string))) {
      socket.emit('sync:error', { message: 'No tienes acceso a esta sala' });
      return;
    }

    socket.emit('sync:state', getRoomSyncState(roomId));
  });

  socket.on('sync:setVideoId', async (data: { roomId: string; videoId: string }) => {
    const { roomId, videoId } = data ?? ({} as never);
    if (!roomId || !videoId) return;

    if (!(await isRoomHost(roomId, socket.data.userId as string))) return;

    setRoomSyncState(roomId, { videoId, position: 0, playing: false, timestamp: Date.now() });
  });

  // Latido periódico: corrige la deriva de los participantes
  socket.on(
    'sync:heartbeat',
    async (data: { roomId: string; position: number; playing: boolean }) => {
      const { roomId, position, playing } = data ?? ({} as never);
      if (!roomId || !isValidPosition(position)) return;

      if (!(await isRoomHost(roomId, socket.data.userId as string))) return;

      const serverTime = Date.now();
      const cleanPosition = Math.floor(position);

      setRoomSyncState(roomId, {
        position: cleanPosition,
        playing: !!playing,
        timestamp: serverTime,
      });

      socket.to(`room:${roomId}`).emit('sync:heartbeat', {
        position: cleanPosition,
        playing: !!playing,
        serverTime,
      });
    },
  );
}
