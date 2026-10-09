import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useRoomStore } from '../stores/roomStore';
import { api } from '../lib/api';
import {
  connectSocket,
  disconnectSocket,
  getSocket,
  setReconnectHandler,
} from '../lib/socket';
import { VideoPlayer, type VideoPlayerRef } from '../components/room/VideoPlayer';
import { YouTubePlayer, type YouTubePlayerRef } from '../components/room/YouTubePlayer';
import { Chat } from '../components/room/Chat';
import { ParticipantList } from '../components/room/ParticipantList';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import type { Room as RoomType, Video, ChatMessage } from '../types';

type AnyPlayerRef = VideoPlayerRef | YouTubePlayerRef;

export function Room() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const playerRef = useRef<AnyPlayerRef>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showVideoSelector, setShowVideoSelector] = useState(false);
  const [videos, setVideos] = useState<Video[]>([]);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [notice, setNotice] = useState('');

  const { user } = useAuthStore();
  const {
    currentRoom,
    setCurrentRoom,
    setParticipants,
    setMessages,
    isHost,
    setIsHost,
    reset,
  } = useRoomStore();

  const isYouTube = currentRoom?.video?.source === 'youtube';

  // --- Carga inicial de la sala ---------------------------------------
  const loadRoom = useCallback(async () => {
    if (!roomId) return;

    const data = await api.get<{ room: RoomType }>(`/rooms/${roomId}`);
    setCurrentRoom(data.room);
    setParticipants(data.room.participants);
    setIsHost(data.room.hostId === user?.id);

    const msgData = await api.get<{ messages: ChatMessage[] }>(`/rooms/${roomId}/messages`);
    setMessages(msgData.messages);
  }, [roomId, user?.id, setCurrentRoom, setParticipants, setMessages, setIsHost]);

  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;

    const bootstrap = async () => {
      setLoading(true);
      setError('');
      try {
        await loadRoom();
        if (cancelled) return;

        const socket = connectSocket();

        // Unirse a la sala solo cuando el socket esté listo
        const join = () => {
          socket.emit('room:join', { roomId });
          socket.emit('sync:requestState', { roomId });
        };

        if (socket.connected) join();
        else socket.once('connect', join);

        // Al reconectar hay que volver a unirse: la membresía se perdió
        setReconnectHandler(join);

        if (!cancelled) setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Error al cargar la sala');
          setLoading(false);
        }
      }
    };

    bootstrap();

    return () => {
      cancelled = true;
      setReconnectHandler(null);
      disconnectSocket();
      reset();
    };
  }, [roomId, loadRoom]);

  // --- Eventos del socket ----------------------------------------------
  useEffect(() => {
    if (!roomId) return;
    const socket = getSocket();

    const refreshParticipants = () => {
      api
        .get<{ room: RoomType }>(`/rooms/${roomId}`)
        .then((data) => setParticipants(data.room.participants))
        .catch(() => undefined);
    };

    const handleRoomClosed = () => {
      alert('La sala ha sido cerrada por el anfitrión');
      navigate('/');
    };

    const handleVideoChanged = () => {
      api
        .get<{ room: RoomType }>(`/rooms/${roomId}`)
        .then((data) => setCurrentRoom(data.room))
        .catch(() => undefined);
    };

    const handleSyncState = (state: {
      position: number;
      playing: boolean;
      timestamp: number;
    }) => {
      const player = playerRef.current;
      if (!player) return;
      player.seek(state.position);
      if (state.playing) player.play();
      else player.pause();
    };

    const handleSyncError = (data: { message: string }) => {
      setNotice(data.message);
      setTimeout(() => setNotice(''), 4000);
    };

    socket.on('room:userJoined', refreshParticipants);
    socket.on('room:userLeft', refreshParticipants);
    socket.on('room:closed', handleRoomClosed);
    socket.on('room:videoChanged', handleVideoChanged);
    socket.on('sync:state', handleSyncState);
    socket.on('sync:error', handleSyncError);

    return () => {
      socket.off('room:userJoined', refreshParticipants);
      socket.off('room:userLeft', refreshParticipants);
      socket.off('room:closed', handleRoomClosed);
      socket.off('room:videoChanged', handleVideoChanged);
      socket.off('sync:state', handleSyncState);
      socket.off('sync:error', handleSyncError);
    };
  }, [roomId, navigate, setCurrentRoom, setParticipants]);

  // --- Acciones ---------------------------------------------------------
  const handleLeaveRoom = async () => {
    if (!roomId) return;
    try {
      await api.post(`/rooms/${roomId}/leave`);
      getSocket().emit('room:leave', { roomId });
    } catch {
      // Aunque falle el registro en la BD, hay que salir de la pantalla
    }
    disconnectSocket();
    reset();
    navigate('/');
  };

  const handleCloseRoom = async () => {
    if (!roomId) return;
    try {
      await api.post(`/rooms/${roomId}/close`);
      getSocket().emit('room:close', { roomId });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cerrar la sala');
    }
  };

  const handleSelectVideo = async (videoId: string) => {
    if (!roomId) return;
    try {
      await api.post(`/rooms/${roomId}/video`, { videoId });
      getSocket().emit('room:setVideo', { roomId, videoId });
      getSocket().emit('sync:setVideoId', { roomId, videoId });

      const data = await api.get<{ room: RoomType }>(`/rooms/${roomId}`);
      setCurrentRoom(data.room);
      setShowVideoSelector(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al seleccionar video');
    }
  };

  const loadVideos = async () => {
    setLoadingVideos(true);
    try {
      const data = await api.get<{ videos: Video[] }>('/videos');
      setVideos(data.videos);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los videos');
    } finally {
      setLoadingVideos(false);
    }
  };

  const openVideoSelector = () => {
    setShowVideoSelector(true);
    void loadVideos();
  };

  // --- Estados de carga -------------------------------------------------
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4" />
          <p className="text-white">Cargando sala...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <Button onClick={() => navigate('/')}>Volver</Button>
        </div>
      </div>
    );
  }

  if (!currentRoom) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <p className="text-white mb-4">Sala no encontrada</p>
          <Button onClick={() => navigate('/')}>Volver</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-white font-bold">StreamTogether</h1>
            <span className="px-2 py-1 bg-gray-700 text-gray-300 text-sm font-mono rounded">
              {currentRoom.code}
            </span>
            {isYouTube && (
              <span className="px-2 py-1 bg-red-600 text-white text-xs font-medium rounded">
                YouTube
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isHost && (
              <Button variant="danger" size="sm" onClick={handleCloseRoom}>
                Cerrar sala
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={() => setShowLeaveModal(true)}>
              Salir
            </Button>
          </div>
        </div>
      </header>

      {notice && (
        <div className="bg-amber-500 text-gray-900 text-sm text-center py-2 px-4">
          {notice}
        </div>
      )}

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 flex flex-col lg:flex-row gap-4">
        <div className="flex-1">
          {currentRoom.video ? (
            isYouTube && currentRoom.video.youtubeId ? (
              <YouTubePlayer
                key={currentRoom.video.id}
                ref={playerRef as React.Ref<YouTubePlayerRef>}
                videoId={currentRoom.video.youtubeId}
                title={currentRoom.video.title}
              />
            ) : (
              <VideoPlayer
                key={currentRoom.video.id}
                ref={playerRef as React.Ref<VideoPlayerRef>}
                src={currentRoom.video.videoUrl}
              />
            )
          ) : (
            <div className="aspect-video bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-700">
              <div className="text-center p-8">
                <div className="w-20 h-20 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4 text-4xl">
                  ▶
                </div>
                <p className="text-gray-400 text-lg mb-2">No hay video seleccionado</p>
                <p className="text-gray-500 text-sm mb-6">
                  {isHost
                    ? 'Selecciona un video para empezar'
                    : 'Esperando a que el anfitrión seleccione un video'}
                </p>
                {isHost && (
                  <Button
                    onClick={openVideoSelector}
                    className="bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 border-0"
                  >
                    Seleccionar video
                  </Button>
                )}
              </div>
            </div>
          )}

          <div className="mt-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-white font-semibold text-lg truncate">
                {currentRoom.video?.title || 'Sin video'}
              </h2>
              {currentRoom.video?.description && (
                <p className="text-gray-400 text-sm">{currentRoom.video.description}</p>
              )}
            </div>
            {isHost && (
              <Button
                variant="secondary"
                size="sm"
                onClick={openVideoSelector}
                className="shrink-0"
              >
                {currentRoom.video ? 'Cambiar video' : 'Seleccionar video'}
              </Button>
            )}
          </div>
        </div>

        <div className="w-full lg:w-80 flex flex-col gap-4">
          <ParticipantList />
          <div className="flex-1 min-h-[300px]">
            <Chat />
          </div>
        </div>
      </main>

      <Modal
        isOpen={showVideoSelector}
        onClose={() => setShowVideoSelector(false)}
        title="Seleccionar Video"
      >
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {loadingVideos ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">Cargando videos...</p>
            </div>
          ) : videos.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-2">No hay videos disponibles</p>
              <p className="text-gray-400 text-sm">
                Agrega uno desde la página principal
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-500 mb-3">
                {videos.length} video{videos.length !== 1 ? 's' : ''} disponible
                {videos.length !== 1 ? 's' : ''}
              </p>
              {videos.map((video) => (
                <button
                  key={video.id}
                  onClick={() => handleSelectVideo(video.id)}
                  className="w-full p-3 text-left hover:bg-pink-50 rounded-lg border-2 border-gray-200 hover:border-pink-300 transition-all flex gap-3"
                >
                  {video.thumbnailUrl ? (
                    <img
                      src={video.thumbnailUrl}
                      alt=""
                      className="w-20 h-12 object-cover rounded flex-shrink-0"
                    />
                  ) : (
                    <div className="w-20 h-12 bg-gradient-to-br from-pink-500 to-purple-500 rounded flex items-center justify-center flex-shrink-0 text-white">
                      ▶
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900 truncate">{video.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={`px-1.5 py-0.5 text-xs font-medium rounded ${
                          video.source === 'youtube'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {video.source === 'youtube' ? 'YouTube' : 'Archivo'}
                      </span>
                      {video.duration > 0 && (
                        <span className="text-xs text-gray-500">
                          {Math.floor(video.duration / 60)}:
                          {String(video.duration % 60).padStart(2, '0')}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={showLeaveModal}
        onClose={() => setShowLeaveModal(false)}
        title="Salir de la sala"
      >
        <p className="text-gray-600 mb-6">¿Estás seguro de que quieres salir de la sala?</p>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={() => setShowLeaveModal(false)}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={handleLeaveRoom}>
            Salir
          </Button>
        </div>
      </Modal>
    </div>
  );
}