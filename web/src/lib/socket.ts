import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../stores/authStore';

let socket: Socket | null = null;

/**
 * URL del backend.
 *
 * - Desarrollo: vacío (mismo origen) → el proxy de Vite enruta /api y /socket.io
 *   al puerto 3001.
 * - Producción: se define VITE_API_URL con el dominio del backend, porque
 *   el frontend y el backend quedan en dominios distintos.
 */
function socketUrl(): string {
  const configured = import.meta.env.VITE_API_URL as string | undefined;
  if (configured) return configured;
  return typeof window !== 'undefined' ? window.location.origin : '/';
}

/** Callback invocado cada vez que el socket (re)conecta, para re-sincronizar. */
let onReconnect: (() => void) | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const token = useAuthStore.getState().token;

    socket = io(socketUrl(), {
      auth: { token },
      autoConnect: false,
      // Reconexión automática ante perdida de señal (móvil, WiFi, etc.)
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

    // Tras cada reconexión hay que volver a unirse a la sala: la membresía
    // de los rooms vive en el servidor y se pierde al caer la conexión.
    socket.on('connect', () => {
      if (onReconnect) onReconnect();
    });

    socket.on('connect_error', (err: Error) => {
      console.error('[socket] error de conexión:', err.message);
    });
  }

  return socket;
}

export function connectSocket(): Socket {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket() {
  if (socket) {
    onReconnect = null;
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}

/** Registra la lógica de re-sincronización que se ejecuta en cada reconexión. */
export function setReconnectHandler(handler: (() => void) | null) {
  onReconnect = handler;
}
