import { useCallback, useEffect, useRef } from 'react';
import { getSocket } from '../lib/socket';
import { ClockSync, targetPosition, evaluateDrift, type DriftAction } from '../lib/clockSync';

/**
 * Controles minimos que debe exponer cualquier player (HTML5 o YouTube)
 * para poder participar en la sincronizacion.
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

/** Cada cuanto el anfitrion recuerda donde va el video. */
const HEARTBEAT_MS = 5000;

export interface UseMediaSyncOptions {
  isHost: boolean;
  roomId: string | null;
  controlsRef: React.RefObject<MediaControls | null>;
  /** Se invoca cuando la correccion fue demasiado grande como para hacerla en silencio. */
  onHardDrift?: (delta: number, current: number) => void;
}

export interface MediaSyncApi {
  /** El anfitrion notifica que empezo a reproducir. */
  notifyPlay: (position: number) => void;
  /** El anfitrion notifica que pauso. */
  notifyPause: (position: number) => void;
  /** El anfitrion notifica un salto. */
  notifySeek: (position: number) => void;
  /** Marca el estado de reproduccion sin provocar re-renders. */
  setIsPaused: (paused: boolean) => void;
}

/**
 * Sincroniza el player con el resto de la sala.
 *
 * El anfitrion es la fuente de verdad: emit play/pause/seek y un latido
 * periodico. Los participantes reciben los eventos y ajustan su player,
 * corrigiendo la deriva de reloj.
 */
export function useMediaSync(options: UseMediaSyncOptions): MediaSyncApi {
  const { isHost, roomId, controlsRef, onHardDrift } = options;

  // El reloj se conserva entre renders: recalibrarlo en cada render
  // perderia las muestras y la mediana dejaria de ser util
  const clockRef = useRef(new ClockSync());

  // Referencia al player sin tocar dependencias: si no, el efecto de
  // escucha se volveria a registrar en cada render del player
  const isPausedRef = useRef(true);

  const onHardDriftRef = useRef(onHardDrift);
  useEffect(() => {
    onHardDriftRef.current = onHardDrift;
  }, [onHardDrift]);

  const setIsPaused = useCallback((paused: boolean) => {
    isPausedRef.current = paused;
  }, []);

  // ---- Eventos que el anfitrion envia --------------------------------
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

  const notifyPlay = useCallback((p: number) => sendEvent('play', p), [sendEvent]);
  const notifyPause = useCallback((p: number) => sendEvent('pause', p), [sendEvent]);
  const notifySeek = useCallback((p: number) => sendEvent('seek', p), [sendEvent]);

  // ---- Eventos que el participante recibe ----------------------------
  useEffect(() => {
    // El anfitrion no aplica correcciones: es el que las genera
    if (isHost) return;

    const socket = getSocket();
    const clock = clockRef.current;

    const applyRemoteState = (
      payload: { position: number; serverTime: number },
      shouldPlay: boolean | null,
    ) => {
      const controls = controlsRef.current;
      if (!controls) return;

      clock.addSample(payload.serverTime);

      const target = targetPosition(payload, clock);
      const current = controls.getCurrentTime();
      const { action, delta } = evaluateDrift(current, target);

      if (action === 'none') {
        // Aun sin corregir posicion, puede hacer falta cambiar el estado
        if (shouldPlay === true) controls.play();
        else if (shouldPlay === false) controls.pause();
        return;
      }

      if (action === 'warn') {
        onHardDriftRef.current?.(delta, current);
      }

      controls.seek(Math.max(0, target));

      if (shouldPlay === true) controls.play();
      else if (shouldPlay === false) controls.pause();
    };

    const handleSyncEvent = (data: SyncPayload) => {
      // 'pause' significa que hay que detener; play y seek, que no
      applyRemoteState(data, data.type !== 'pause');
    };

    const handleHeartbeat = (data: { position: number; playing: boolean; serverTime: number }) => {
      applyRemoteState(data, data.playing);
    };

    socket.on('sync:event', handleSyncEvent);
    socket.on('sync:heartbeat', handleHeartbeat);

    return () => {
      socket.off('sync:event', handleSyncEvent);
      socket.off('sync:heartbeat', handleHeartbeat);
      // Al salir de la sala el reloj ya no es valido: la proxima sala
      // tendria otro anfitrion y otro desfase
      clock.reset();
    };
  }, [isHost, controlsRef]);

  // ---- Latido periodico del anfitrion --------------------------------
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
    }, HEARTBEAT_MS);

    return () => clearInterval(interval);
  }, [isHost, roomId, controlsRef]);

  return { notifyPlay, notifyPause, notifySeek, setIsPaused };
}

export type { DriftAction };
