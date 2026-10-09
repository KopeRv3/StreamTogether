import { useCallback, useEffect, useRef } from 'react';
import { getSocket } from '../lib/socket';

/**
 * Controles mínimos que debe exponer cualquier player (HTML5 o YouTube)
 * para poder participar en la sincronización.
 */
export interface MediaControls {
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  getCurrentTime: () => number;
}

export interface SyncPayload {
  type: 'play' | 'pause' | 'seek';
  position: number;
  serverTime: number;
}

/** Corrección máxima que se aplica sin avisar al usuario (segundos). */
const SILENT_DRIFT_CORRECTION = 1.25;
/** Corrección máxima total (segundos). Por encima, se avisará en la UI. */
const HARD_DRIFT_LIMIT = 20;

export function useMediaSync(options: {
  isHost: boolean;
  roomId: string | null;
  controlsRef: React.RefObject<MediaControls | null>;
  /** Se llama cuando el servidor confirma un salto grande de posición. */
  onHardDrift?: (target: number, current: number) => void;
}) {
  const { isHost, roomId, controlsRef, onHardDrift } = options;

  /**
   * Diferencia estimada entre el reloj del servidor y el del navegador.
   * Sin esto, comparar `Date.now()` del cliente contra `serverTime` produce
   * un desfase constante si los relojes no coinciden.
   */
  const clockOffsetRef = useRef(0);
  const offsetInitialisedRef = useRef(false);

  /**
   * Permite al latido saber si el player está reproduciendo sin releer el
   * estado en cada tick (y forzar re-renders innecesarios).
   */
  const isPausedRef = useRef(true);

  const setIsPaused = useCallback((paused: boolean) => {
    isPausedRef.current = paused;
  }, []);

  /** Convierte un instante del cliente al equivalente del servidor. */
  const toServerTime = useCallback((clientNow: number) => {
    return clientNow + clockOffsetRef.current;
  }, []);

  /** Posición objetivo del player según el estado del servidor. */
  const targetPosition = useCallback(
    (payload: { position: number; serverTime: number }) => {
      const nowOnServer = toServerTime(Date.now());
      const elapsed = Math.max(0, (nowOnServer - payload.serverTime) / 1000);
      return payload.position + elapsed;
    },
    [toServerTime],
  );

  // ---- Eventos que el anfitrión envía -------------------------------
  const sendEvent = useCallback(
    (type: 'play' | 'pause' | 'seek', position: number) => {
      if (!isHost || !roomId) return;
      getSocket().emit('sync:event', {
        roomId,
        type,
        position: Math.max(0, Math.floor(position)),
      });
    },
    [isHost, roomId],
  );

  const notifyPlay = useCallback(
    (position: number) => sendEvent('play', position),
    [sendEvent],
  );
  const notifyPause = useCallback(
    (position: number) => sendEvent('pause', position),
    [sendEvent],
  );
  const notifySeek = useCallback(
    (position: number) => sendEvent('seek', position),
    [sendEvent],
  );

  // ---- Eventos que el participante recibe ----------------------------
  useEffect(() => {
    const socket = getSocket();

    const learnClockOffset = (serverTime: number) => {
      const sample = serverTime - Date.now();
      if (!offsetInitialisedRef.current) {
        clockOffsetRef.current = sample;
        offsetInitialisedRef.current = true;
      } else {
        // Suavizado exponencial: ignora picos aislados de latencia
        clockOffsetRef.current = clockOffsetRef.current * 0.8 + sample * 0.2;
      }
    };

    const applyPosition = (position: number, shouldPlay: boolean | null) => {
      const controls = controlsRef.current;
      if (!controls) return;

      const current = controls.getCurrentTime();
      const drift = position - current;
      const absDrift = Math.abs(drift);

      // Solo se corrige si la diferencia es apreciable.
      // Un salto de 100 ms es ruido normal de decodificación.
      if (absDrift > SILENT_DRIFT_CORRECTION) {
        if (absDrift > HARD_DRIFT_LIMIT && onHardDrift) {
          onHardDrift(position, current);
        }
        controls.seek(Math.max(0, position));
      }

      if (shouldPlay === true) controls.play();
      else if (shouldPlay === false) controls.pause();
    };

    const handleSyncEvent = (data: SyncPayload) => {
      if (isHost) return;
      learnClockOffset(data.serverTime);
      applyPosition(targetPosition(data), data.type !== 'pause');
    };

    const handleHeartbeat = (data: {
      position: number;
      playing: boolean;
      serverTime: number;
    }) => {
      if (isHost) return;
      learnClockOffset(data.serverTime);
      applyPosition(targetPosition(data), data.playing);
    };

    socket.on('sync:event', handleSyncEvent);
    socket.on('sync:heartbeat', handleHeartbeat);

    return () => {
      socket.off('sync:event', handleSyncEvent);
      socket.off('sync:heartbeat', handleHeartbeat);
    };
  }, [isHost, controlsRef, targetPosition, onHardDrift]);

  // ---- Latido periódico del anfitrión --------------------------------
  useEffect(() => {
    if (!isHost || !roomId) return;

    const interval = setInterval(() => {
      const controls = controlsRef.current;
      if (!controls) return;

      getSocket().emit('sync:heartbeat', {
        roomId,
        position: controls.getCurrentTime(),
        playing: !isPausedRef.current,
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [isHost, roomId, controlsRef]);

  return { notifyPlay, notifyPause, notifySeek, setIsPaused };
}