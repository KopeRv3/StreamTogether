import { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { useRoomStore } from '../../stores/roomStore';
import { useAuthStore } from '../../stores/authStore';
import { getSocket } from '../../lib/socket';

interface VideoPlayerProps {
  src: string;
  onTimeUpdate?: (currentTime: number) => void;
  onDurationChange?: (duration: number) => void;
  onPlay?: () => void;
  onPause?: () => void;
  onSeek?: (time: number) => void;
}

export interface VideoPlayerRef {
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
}

export const VideoPlayer = forwardRef<VideoPlayerRef, VideoPlayerProps>(
  ({ src, onTimeUpdate, onDurationChange, onPlay, onPause, onSeek }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const hideControlsTimeout = useRef<NodeJS.Timeout | null>(null);

    const { isHost, currentRoom, syncState, setSyncState } = useRoomStore();
    const { user } = useAuthStore();

    useImperativeHandle(ref, () => ({
      play: () => videoRef.current?.play(),
      pause: () => videoRef.current?.pause(),
      seek: (time: number) => {
        if (videoRef.current) {
          videoRef.current.currentTime = time;
        }
      },
      getCurrentTime: () => videoRef.current?.currentTime || 0,
      getDuration: () => videoRef.current?.duration || 0,
    }));

    // Auto-play when video source changes
    useEffect(() => {
      if (src && videoRef.current) {
        videoRef.current.load();
        const playVideo = () => {
          videoRef.current?.play().catch(() => {
            // Autoplay was prevented
          });
        };
        const timeout = setTimeout(playVideo, 100);
        return () => clearTimeout(timeout);
      }
    }, [src]);

    // Handle sync events from server (for participants only)
    useEffect(() => {
      const socket = getSocket();

      const handleSyncEvent = (data: { type: 'play' | 'pause' | 'seek'; position: number; serverTime: number }) => {
        if (isHost) return;
        const delay = (Date.now() - data.serverTime) / 1000;
        const targetPosition = data.position + delay;

        if (videoRef.current) {
          if (data.type === 'play') {
            videoRef.current.currentTime = targetPosition;
            videoRef.current.play();
          } else if (data.type === 'pause') {
            videoRef.current.pause();
            videoRef.current.currentTime = targetPosition;
          } else if (data.type === 'seek') {
            videoRef.current.currentTime = targetPosition;
          }
        }
      };

      const handleHeartbeat = (data: { position: number; playing: boolean; serverTime: number }) => {
        if (isHost) return;
        const delay = (Date.now() - data.serverTime) / 1000;
        const targetPosition = data.position + delay;
        const currentPos = videoRef.current?.currentTime || 0;

        if (Math.abs(currentPos - targetPosition) > 2 && videoRef.current) {
          videoRef.current.currentTime = targetPosition;
        }

        if (data.playing && videoRef.current?.paused) {
          videoRef.current.play();
        } else if (!data.playing && videoRef.current && !videoRef.current.paused) {
          videoRef.current.pause();
        }
      };

      socket.on('sync:event', handleSyncEvent);
      socket.on('sync:heartbeat', handleHeartbeat);

      return () => {
        socket.off('sync:event', handleSyncEvent);
        socket.off('sync:heartbeat', handleHeartbeat);
      };
    }, [isHost]);

    // Host: send sync events
    const sendSyncEvent = (type: 'play' | 'pause' | 'seek', position: number) => {
      if (!isHost || !currentRoom) return;
      const socket = getSocket();
      socket.emit('sync:event', { roomId: currentRoom.id, type, position });
    };

    // Host: heartbeat cada 5 segundos
    useEffect(() => {
      if (!isHost || !currentRoom) return;
      const interval = setInterval(() => {
        const socket = getSocket();
        socket.emit('sync:heartbeat', {
          roomId: currentRoom.id,
          position: videoRef.current?.currentTime || 0,
          playing: !videoRef.current?.paused,
        });
      }, 5000);
      return () => clearInterval(interval);
    }, [isHost, currentRoom]);

    const handlePlay = () => {
      setIsPlaying(true);
      sendSyncEvent('play', videoRef.current?.currentTime || 0);
      onPlay?.();
    };

    const handlePause = () => {
      setIsPlaying(false);
      sendSyncEvent('pause', videoRef.current?.currentTime || 0);
      onPause?.();
    };

    const handleSeek = (time: number) => {
      if (videoRef.current) {
        videoRef.current.currentTime = time;
        sendSyncEvent('seek', time);
        onSeek?.(time);
      }
    };

    const handleTimeUpdate = () => {
      const time = videoRef.current?.currentTime || 0;
      setCurrentTime(time);
      onTimeUpdate?.(time);
    };

    const handleLoadedMetadata = () => {
      const dur = videoRef.current?.duration || 0;
      setDuration(dur);
      onDurationChange?.(dur);
    };

    const togglePlay = () => {
      if (videoRef.current?.paused) {
        videoRef.current.play();
      } else {
        videoRef.current?.pause();
      }
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const vol = parseFloat(e.target.value);
      setVolume(vol);
      if (videoRef.current) {
        videoRef.current.volume = vol;
        setIsMuted(vol === 0);
      }
    };

    const toggleMute = () => {
      if (videoRef.current) {
        videoRef.current.muted = !videoRef.current.muted;
        setIsMuted(videoRef.current.muted);
      }
    };

    const handleMouseMove = () => {
      setShowControls(true);
      if (hideControlsTimeout.current) clearTimeout(hideControlsTimeout.current);
      hideControlsTimeout.current = setTimeout(() => {
        if (isPlaying) setShowControls(false);
      }, 3000);
    };

    const formatTime = (time: number) => {
      const hours = Math.floor(time / 3600);
      const minutes = Math.floor((time % 3600) / 60);
      const seconds = Math.floor(time % 60);
      if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      }
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    return (
      <div
        className="relative bg-black rounded-lg overflow-hidden group"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => isPlaying && setShowControls(false)}
      >
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

        <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
          <div className="mb-3">
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={(e) => handleSeek(parseFloat(e.target.value))}
              className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-primary-500"
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={togglePlay} className="text-white hover:text-primary-400 transition-colors">
                {isPlaying ? (
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" /></svg>
                ) : (
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                )}
              </button>
              <div className="flex items-center gap-2">
                <button onClick={toggleMute} className="text-white hover:text-primary-400 transition-colors">
                  {isMuted || volume === 0 ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" /></svg>
                  ) : (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" /></svg>
                  )}
                </button>
                <input type="range" min={0} max={1} step={0.1} value={isMuted ? 0 : volume} onChange={handleVolumeChange} className="w-20 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-white" />
              </div>
              <span className="text-white text-sm">{formatTime(currentTime)} / {formatTime(duration)}</span>
            </div>
            <button onClick={() => { if (videoRef.current) { if (document.fullscreenElement) { document.exitFullscreen(); } else { videoRef.current.requestFullscreen(); } } }} className="text-white hover:text-primary-400 transition-colors">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" /></svg>
            </button>
          </div>
        </div>
      </div>
    );
  }
);

VideoPlayer.displayName = 'VideoPlayer';