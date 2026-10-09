import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useRoomStore } from '../../stores/roomStore';
import { useMediaSync, MediaControls } from '../../hooks/useMediaSync';
import {
  loadYouTubeApi,
  YT_STATE,
  type YTPlayer,
  } from '../../lib/youtube';

export interface YouTubePlayerRef extends MediaControls {
  getDuration: () => number;
}

/**
 * Player de YouTube basado en la IFrame Player API.
 *
 * No se puede usar un <iframe> normal porque, por seguridad de origen,
 * el navegador no deja leer ni escribir currentTime desde fuera. La API
 * oficial sí lo permite, que es justo lo que necesita la sincronización.
 */
export const YouTubePlayer = forwardRef<YouTubePlayerRef, { videoId: string; title?: string }>(
  ({ videoId, title }, ref) => {
    const mountRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<YTPlayer | null>(null);
    const [ready, setReady] = useState(false);
    const [error, setError] = useState('');
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    const { isHost, currentRoom } = useRoomStore();

    // --- Controles que ve el hook de sincronización -------------------
    const controls = useRef<MediaControls>({
      play: () => playerRef.current?.playVideo(),
      pause: () => playerRef.current?.pauseVideo(),
      seek: (time: number) => playerRef.current?.seekTo(time, true),
      getCurrentTime: () => playerRef.current?.getCurrentTime() ?? 0,
    });

    const controlsRef = useRef<MediaControls | null>(controls.current);

    const { notifyPlay, notifyPause, notifySeek, setIsPaused } = useMediaSync({
      isHost,
      roomId: currentRoom?.id ?? null,
      controlsRef,
    });

    useImperativeHandle(ref, () => ({
      play: () => playerRef.current?.playVideo(),
      pause: () => playerRef.current?.pauseVideo(),
      seek: (time: number) => playerRef.current?.seekTo(Math.max(0, time), true),
      getCurrentTime: () => playerRef.current?.getCurrentTime() ?? 0,
      getDuration: () => playerRef.current?.getDuration() ?? 0,
    }));

    // --- Crear el player ----------------------------------------------
    useEffect(() => {
      let cancelled = false;
      let created: YTPlayer | null = null;

      loadYouTubeApi()
        .then(() => {
          if (cancelled || !mountRef.current || !window.YT) return;

          created = new window.YT.Player(mountRef.current, {
            videoId,
            playerVars: {
              enablejsapi: 1,
              rel: 0,
              modestbranding: 1,
              playsinline: 1,
              origin: window.location.origin,
            },
            events: {
              onReady: (event) => {
                if (cancelled) return;
                playerRef.current = event.target;
                setDuration(event.target.getDuration() || 0);
                setReady(true);
              },
              onStateChange: (event) => {
                if (cancelled) return;

                const player = event.target;
                const state = event.data;

                if (state === YT_STATE.PLAYING) {
                  setIsPlaying(true);
                  setIsPaused(false);
                  if (isHost) notifyPlay(player.getCurrentTime());
                } else if (state === YT_STATE.PAUSED) {
                  setIsPlaying(false);
                  setIsPaused(true);
                  if (isHost) notifyPause(player.getCurrentTime());
                } else if (state === YT_STATE.ENDED) {
                  setIsPlaying(false);
                  setIsPaused(true);
                }
              },
              onError: (event) => {
                if (cancelled) return;
                const messages: Record<number, string> = {
                  2: 'El ID del video no es válido.',
                  5: 'No se puede reproducir en HTML5.',
                  100: 'El video ya no está disponible.',
                  101: 'El dueño del video no permite reproducirlo.',
                  150: 'El dueño del video no permite reproducirlo.',
                };
                setError(messages[event.data] ?? 'No se pudo cargar el video de YouTube.');
              },
            },
          });

          playerRef.current = created;
        })
        .catch((err: Error) => {
          if (!cancelled) setError(err.message);
        });

      return () => {
        cancelled = true;
        setReady(false);
        try {
          playerRef.current?.destroy();
        } catch {
          // destroy() puede fallar si el player nunca llegó a crearse
        }
        playerRef.current = null;
      };
    }, [videoId, isHost, notifyPlay, notifyPause, setIsPaused]);

    // --- Barra de progreso local (solo lectura para participantes) -----
    useEffect(() => {
      if (!ready) return;
      const interval = setInterval(() => {
        setCurrentTime(playerRef.current?.getCurrentTime() ?? 0);
      }, 500);
      return () => clearInterval(interval);
    }, [ready]);

    // --- Controles manuales -------------------------------------------
    const handleTogglePlay = useCallback(() => {
      const player = playerRef.current;
      if (!player) return;

      if (player.getPlayerState() === YT_STATE.PLAYING) {
        player.pauseVideo();
      } else {
        player.playVideo();
      }
    }, []);

    const handleScrub = useCallback(
      (value: number) => {
        const player = playerRef.current;
        if (!player) return;

        player.seekTo(value, true);
        setCurrentTime(value);
        if (isHost) notifySeek(value);
      },
      [isHost, notifySeek],
    );

    const formatTime = (time: number) => {
      if (!Number.isFinite(time)) return '0:00';
      const hours = Math.floor(time / 3600);
      const minutes = Math.floor((time % 3600) / 60);
      const seconds = Math.floor(time % 60);
      if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      }
      return `${minutes}:${String(seconds).padStart(2, '0')}`;
    };

    if (error) {
      return (
        <div className="aspect-video w-full rounded-lg bg-red-950 flex items-center justify-center p-6 text-center">
          <div>
            <p className="text-red-300 font-medium mb-1">Video de YouTube no disponible</p>
            <p className="text-red-400/80 text-sm">{error}</p>
          </div>
        </div>
      );
    }

    return (
      <div className="relative bg-black rounded-lg overflow-hidden">
        <div ref={mountRef} className="w-full aspect-video" />

        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white" />
          </div>
        )}

        {/* Barra de progreso: el anfitrión puede arrastrar, los demás observan */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/85 to-transparent px-4 pt-8 pb-3">
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={Math.min(currentTime, duration || 100)}
            onChange={(e) => handleScrub(parseFloat(e.target.value))}
            disabled={!isHost || !ready}
            className="w-full h-1 bg-white/25 rounded-lg appearance-none cursor-pointer disabled:cursor-not-allowed accent-pink-500"
            aria-label="Posición del video"
          />
          <div className="flex items-center justify-between mt-2 text-white text-sm">
            <span className="font-mono tabular-nums">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
            {isHost ? (
              <button
                onClick={handleTogglePlay}
                disabled={!ready}
                className="flex items-center gap-2 px-3 py-1 rounded bg-white/10 hover:bg-white/20 transition disabled:opacity-50"
              >
                {isPlaying ? '❚❚ Pausar' : '▶ Reproducir'}
              </button>
            ) : (
              <span className="text-white/60 text-xs">
                Sincronizado con el anfitrión
              </span>
            )}
          </div>
          {title && <p className="text-white/60 text-xs mt-1 truncate">{title}</p>}
        </div>
      </div>
    );
  },
);

YouTubePlayer.displayName = 'YouTubePlayer';