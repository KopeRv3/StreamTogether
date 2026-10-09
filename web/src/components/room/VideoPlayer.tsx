import { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { useRoomStore } from '../../stores/roomStore';
import { useMediaSync, type MediaControls } from '../../hooks/useMediaSync';

export interface VideoPlayerRef extends MediaControls {
  getDuration: () => number;
}

/**
 * Player de video local (archivos MP4/WebM/MOV subidos al servidor).
 * Comparte la misma interfaz de controles que YouTubePlayer para que la
 * sincronización sea idéntica en ambos casos.
 */
export const VideoPlayer = forwardRef<VideoPlayerRef, { src: string }>(({ src }, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  const { isHost, currentRoom } = useRoomStore();

  const controlsRef = useRef<MediaControls | null>({
    play: () => videoRef.current?.play().catch(() => undefined),
    pause: () => videoRef.current?.pause(),
    seek: (time: number) => {
      if (videoRef.current) videoRef.current.currentTime = Math.max(0, time);
    },
    getCurrentTime: () => videoRef.current?.currentTime ?? 0,
  });

  const { notifyPlay, notifyPause, notifySeek, setIsPaused } = useMediaSync({
    isHost,
    roomId: currentRoom?.id ?? null,
    controlsRef,
  });

  useImperativeHandle(ref, () => ({
    play: () => videoRef.current?.play().catch(() => undefined),
    pause: () => videoRef.current?.pause(),
    seek: (time: number) => {
      if (videoRef.current) videoRef.current.currentTime = Math.max(0, time);
    },
    getCurrentTime: () => videoRef.current?.currentTime ?? 0,
    getDuration: () => videoRef.current?.duration ?? 0,
  }));

  // Carga el nuevo archivo cuando cambia la fuente
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    video.load();
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    setIsPaused(true);
  }, [src, setIsPaused]);

  const handlePlay = () => {
    setIsPlaying(true);
    setIsPaused(false);
    notifyPlay(videoRef.current?.currentTime ?? 0);
  };

  const handlePause = () => {
    setIsPlaying(false);
    setIsPaused(true);
    notifyPause(videoRef.current?.currentTime ?? 0);
  };

  const handleSeek = (time: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = time;
    setCurrentTime(time);
    // Solo el anfitrión genera eventos de salto
    notifySeek(time);
  };

  const handleTimeUpdate = () => {
    setCurrentTime(videoRef.current?.currentTime ?? 0);
  };

  const handleLoadedMetadata = () => {
    setDuration(videoRef.current?.duration ?? 0);
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => undefined);
    else video.pause();
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

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

  return (
    <div className="relative bg-black rounded-lg overflow-hidden group">
      <video
        ref={videoRef}
        src={src}
        className="w-full aspect-video"
        onPlay={handlePlay}
        onPause={handlePause}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onClick={togglePlay}
      />

      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/85 to-transparent p-4">
        <input
          type="range"
          min={0}
          max={duration || 100}
          step={0.1}
          value={Math.min(currentTime, duration || 100)}
          onChange={(e) => handleSeek(parseFloat(e.target.value))}
          disabled={!isHost}
          className="w-full h-1 bg-white/25 rounded-lg appearance-none cursor-pointer disabled:cursor-not-allowed accent-pink-500"
          aria-label="Posición del video"
        />

        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-3">
            <button
              onClick={togglePlay}
              className="text-white hover:text-pink-400 transition-colors"
              aria-label={isPlaying ? 'Pausar' : 'Reproducir'}
            >
              {isPlaying ? (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            <button onClick={toggleMute} aria-label="Silenciar" className="text-white hover:text-pink-400">
              {isMuted || volume === 0 ? '🔇' : '🔊'}
            </button>

            <span className="text-white text-sm font-mono tabular-nums">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <button
            onClick={() => {
              const video = videoRef.current;
              if (!video) return;
              if (document.fullscreenElement) document.exitFullscreen();
              else video.requestFullscreen().catch(() => undefined);
            }}
            aria-label="Pantalla completa"
            className="text-white hover:text-pink-400 transition-colors"
          >
            ⛶
          </button>
        </div>

        {!isHost && (
          <p className="text-white/50 text-xs mt-1">Sincronizado con el anfitrión</p>
        )}
      </div>
    </div>
  );
});

VideoPlayer.displayName = 'VideoPlayer';