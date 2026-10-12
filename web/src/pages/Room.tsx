import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useRoomStore } from '../stores/roomStore';
import { api } from '../lib/api';
import { connectSocket, disconnectSocket, getSocket, setReconnectHandler } from '../lib/socket';
import { VideoPlayer, type VideoPlayerRef } from '../components/room/VideoPlayer';
import { YouTubePlayer, type YouTubePlayerRef } from '../components/room/YouTubePlayer';
import { Chat } from '../components/room/Chat';
import { ParticipantList } from '../components/room/ParticipantList';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import type { Room as RoomType, Video, ChatMessage } from '../types';

type AnyPlayerRef = VideoPlayerRef | YouTubePlayerRef;
type Pestana = 'video' | 'chat' | 'personas';

export function Room() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const playerRef = useRef<AnyPlayerRef>(null);

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [pestana, setPestana] = useState<Pestana>('video');
  const [mostrarVideos, setMostrarVideos] = useState(false);
  const [mostrarSalir, setMostrarSalir] = useState(false);
  const [videos, setVideos] = useState<Video[]>([]);
  const [cargandoVideos, setCargandoVideos] = useState(false);
  const [aviso, setAviso] = useState('');

  const { user } = useAuthStore();
  const { currentRoom, setCurrentRoom, setParticipants, setMessages, isHost, setIsHost, reset } =
    useRoomStore();

  const isYouTube = currentRoom?.video?.source === 'youtube';

  const mostrarAviso = useCallback((texto: string) => {
    setAviso(texto);
    setTimeout(() => setAviso(''), 4000);
  }, []);

  // --- Carga inicial --------------------------------------------------
  const cargarSala = useCallback(async () => {
    if (!roomId) return;

    const data = await api.get<{ room: RoomType }>(`/rooms/${roomId}`);
    setCurrentRoom(data.room);
    setParticipants(data.room.participants);
    setIsHost(data.room.hostId === user?.id);

    const msg = await api.get<{ messages: ChatMessage[] }>(`/rooms/${roomId}/messages`);
    setMessages(msg.messages);
  }, [roomId, user?.id, setCurrentRoom, setParticipants, setMessages, setIsHost]);

  useEffect(() => {
    if (!roomId) return;
    let cancelado = false;

    const arrancar = async () => {
      setCargando(true);
      setError('');

      try {
        await cargarSala();
        if (cancelado) return;

        const socket = connectSocket();

        const unirse = () => {
          socket.emit('room:join', { roomId });
          socket.emit('sync:requestState', { roomId });
        };

        if (socket.connected) unirse();
        else socket.once('connect', unirse);

        // Al reconectar hay que volver a unirse: la membresía vive en el servidor
        setReconnectHandler(unirse);

        if (!cancelado) setCargando(false);
      } catch (err) {
        if (!cancelado) {
          setError(err instanceof Error ? err.message : 'No se pudo abrir la sala');
          setCargando(false);
        }
      }
    };

    void arrancar();

    return () => {
      cancelado = true;
      setReconnectHandler(null);
      disconnectSocket();
      reset();
    };
  }, [roomId, cargarSala]);

  // --- Eventos del socket ---------------------------------------------
  useEffect(() => {
    if (!roomId) return;
    const socket = getSocket();

    const refrescar = () => {
      api
        .get<{ room: RoomType }>(`/rooms/${roomId}`)
        .then((data) => setParticipants(data.room.participants))
        .catch(() => undefined);
    };

    const alCambiarVideo = () => {
      api
        .get<{ room: RoomType }>(`/rooms/${roomId}`)
        .then((data) => setCurrentRoom(data.room))
        .catch(() => undefined);
    };

    const salaCerrada = () => {
      alert('El anfitrión cerró la sala');
      navigate('/');
    };

    const estadoSync = (state: { position: number; playing: boolean }) => {
      const player = playerRef.current;
      if (!player) return;
      player.seek(state.position);
      if (state.playing) player.play();
      else player.pause();
    };

    const errorSync = (data: { message: string }) => mostrarAviso(data.message);

    socket.on('room:userJoined', refrescar);
    socket.on('room:userLeft', refrescar);
    socket.on('room:videoChanged', alCambiarVideo);
    socket.on('room:closed', salaCerrada);
    socket.on('sync:state', estadoSync);
    socket.on('sync:error', errorSync);

    return () => {
      socket.off('room:userJoined', refrescar);
      socket.off('room:userLeft', refrescar);
      socket.off('room:videoChanged', alCambiarVideo);
      socket.off('room:closed', salaCerrada);
      socket.off('sync:state', estadoSync);
      socket.off('sync:error', errorSync);
    };
  }, [roomId, navigate, setCurrentRoom, setParticipants, mostrarAviso]);

  // --- Acciones -------------------------------------------------------
  const salir = async () => {
    if (!roomId) return;
    try {
      await api.post(`/rooms/${roomId}/leave`);
      getSocket().emit('room:leave', { roomId });
    } catch {
      // Aunque falle el registro, hay que salir de la pantalla
    }
    disconnectSocket();
    reset();
    navigate('/');
  };

  const cerrarSala = async () => {
    if (!roomId) return;
    try {
      await api.post(`/rooms/${roomId}/close`);
      getSocket().emit('room:close', { roomId });
    } catch (err) {
      mostrarAviso(err instanceof Error ? err.message : 'No se pudo cerrar');
    }
  };

  const elegirVideo = async (videoId: string) => {
    if (!roomId) return;
    try {
      await api.post(`/rooms/${roomId}/video`, { videoId });
      getSocket().emit('room:setVideo', { roomId, videoId });
      getSocket().emit('sync:setVideoId', { roomId, videoId });

      const data = await api.get<{ room: RoomType }>(`/rooms/${roomId}`);
      setCurrentRoom(data.room);
      setMostrarVideos(false);
      setPestana('video');
    } catch (err) {
      mostrarAviso(err instanceof Error ? err.message : 'No se pudo elegir');
    }
  };

  const abrirSelector = async () => {
    setMostrarVideos(true);
    setCargandoVideos(true);
    try {
      const data = await api.get<{ videos: Video[] }>('/videos');
      setVideos(data.videos);
    } catch {
      mostrarAviso('No se pudo cargar la biblioteca');
    } finally {
      setCargandoVideos(false);
    }
  };

  const copiarCodigo = async () => {
    if (!currentRoom) return;
    try {
      await navigator.clipboard.writeText(currentRoom.code);
      mostrarAviso('Código copiado');
    } catch {
      mostrarAviso(`El código es ${currentRoom.code}`);
    }
  };

  // --- Estados de carga ------------------------------------------------
  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white mx-auto mb-3" />
          <p className="text-white/70 text-sm">Abriendo sala...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 px-4">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <Button onClick={() => navigate('/')}>Volver</Button>
        </div>
      </div>
    );
  }

  if (!currentRoom) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 px-4">
        <div className="text-center">
          <p className="text-white mb-4">La sala ya no existe</p>
          <Button onClick={() => navigate('/')}>Volver</Button>
        </div>
      </div>
    );
  }

  const cantidad = currentRoom.participants.length;

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Cabecera compacta */}
      <header className="bg-gray-800 border-b border-gray-700 px-3 sm:px-4 py-2.5 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
          <button
            onClick={() => navigate('/')}
            className="text-gray-400 hover:text-white transition-colors p-1 -ml-1"
            aria-label="Volver al inicio"
          >
            ←
          </button>

          <button
            onClick={copiarCodigo}
            className="px-2.5 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm font-mono rounded transition-colors flex items-center gap-1.5"
            title="Copiar código"
          >
            {currentRoom.code}
            <span className="text-xs opacity-60">⧉</span>
          </button>

          <div className="flex items-center gap-2">
            {isHost && (
              <button
                onClick={cerrarSala}
                className="px-2.5 py-1.5 text-xs bg-red-600/20 hover:bg-red-600/30 text-red-300 rounded transition-colors"
              >
                Cerrar
              </button>
            )}
            <button
              onClick={() => setMostrarSalir(true)}
              className="px-2.5 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 rounded transition-colors"
            >
              Salir
            </button>
          </div>
        </div>
      </header>

      {aviso && (
        <div className="bg-amber-500 text-gray-900 text-sm text-center py-2 px-4">{aviso}</div>
      )}

      {/* Contenido: una columna en celular, dos en escritorio */}
      <main className="flex-1 max-w-7xl mx-auto w-full">
        {/* P Pestañas: solo en celular */}
        <div className="lg:hidden sticky top-[49px] z-10 bg-gray-900 border-b border-gray-800 flex">
          {(
            [
              ['video', '▶ Video'],
              ['chat', '💬 Chat'],
              ['personas', `👥 ${cantidad}`],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setPestana(id)}
              className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${
                pestana === id ? 'border-pink-500 text-white' : 'border-transparent text-gray-500'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-4 p-3 sm:p-4">
          {/* Video */}
          <div className={pestana === 'video' ? 'block' : 'hidden lg:block'}>
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
              <div className="aspect-video bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl flex items-center justify-center border-2 border-dashed border-gray-700 p-6">
                <div className="text-center">
                  <div className="text-5xl mb-3">▶</div>
                  <p className="text-gray-300 mb-1">No hay video en la sala</p>
                  {isHost ? (
                    <>
                      <p className="text-gray-500 text-sm mb-4">
                        Elige uno de la biblioteca para empezar
                      </p>
                      <Button
                        onClick={abrirSelector}
                        className="bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 border-0"
                      >
                        Elegir video
                      </Button>
                    </>
                  ) : (
                    <p className="text-gray-500 text-sm">
                      Esperando a que el anfitrión elija un video
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="mt-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-white font-semibold truncate">
                  {currentRoom.video?.title ?? 'Sin video'}
                </h2>
                {currentRoom.video?.description && (
                  <p className="text-gray-400 text-sm line-clamp-2">
                    {currentRoom.video.description}
                  </p>
                )}
              </div>

              {isHost && currentRoom.video && (
                <Button variant="secondary" size="sm" onClick={abrirSelector} className="shrink-0">
                  Cambiar
                </Button>
              )}
            </div>
          </div>

          {/* Chat y personas */}
          <aside className="flex flex-col gap-4 mt-4 lg:mt-0">
            <div className={pestana === 'personas' ? 'block' : 'hidden lg:block'}>
              <ParticipantList />
            </div>
            <div
              className={`${pestana === 'chat' ? 'block' : 'hidden lg:block'} flex-1 min-h-[320px] lg:min-h-0`}
            >
              <Chat />
            </div>
          </aside>
        </div>
      </main>

      {/* Selector de video */}
      <Modal isOpen={mostrarVideos} onClose={() => setMostrarVideos(false)} title="Elegir video">
        <div className="space-y-2 max-h-[70vh] overflow-y-auto -mx-1 px-1">
          {cargandoVideos ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500 mx-auto" />
            </div>
          ) : videos.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600 mb-2">La biblioteca está vacía</p>
              <Button onClick={() => navigate('/biblioteca')}>Agregar un video</Button>
            </div>
          ) : (
            videos.map((video) => (
              <button
                key={video.id}
                onClick={() => elegirVideo(video.id)}
                className={`w-full p-3 text-left rounded-xl border-2 transition-all flex gap-3 ${
                  currentRoom.videoId === video.id
                    ? 'border-pink-400 bg-pink-50'
                    : 'border-gray-200 hover:border-pink-300'
                }`}
              >
                {video.thumbnailUrl ? (
                  <img
                    src={video.thumbnailUrl}
                    alt=""
                    className="w-20 h-12 object-cover rounded flex-shrink-0"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-20 h-12 bg-gradient-to-br from-pink-500 to-purple-500 rounded flex items-center justify-center text-white flex-shrink-0">
                    ▶
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900 truncate text-sm">{video.title}</p>
                  <span
                    className={`inline-block mt-1 px-1.5 py-0.5 text-xs rounded ${
                      video.source === 'youtube'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {video.source === 'youtube' ? 'YouTube' : 'Archivo'}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </Modal>

      {/* Confirmar salida */}
      <Modal isOpen={mostrarSalir} onClose={() => setMostrarSalir(false)} title="Salir de la sala">
        <p className="text-gray-600 mb-6">¿Quieres salir?</p>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={() => setMostrarSalir(false)}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={salir}>
            Salir
          </Button>
        </div>
      </Modal>
    </div>
  );
}
