import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../stores/authStore';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const token = useAuthStore.getState().token;
    socket = io('/', {
      auth: { token },
      autoConnect: false,
    });
  }
  return socket;
}

export function connectSocket(): Socket {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
  }
  return s;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}