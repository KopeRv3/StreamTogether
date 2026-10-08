import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useRoomStore } from '../stores/roomStore';
import { api } from '../lib/api';
import { connectSocket, disconnectSocket, getSocket } from '../lib/socket';
import { VideoPlayer, VideoPlayerRef } from '../components/room/VideoPlayer';
import { Chat } from '../components/room/Chat';
import { ParticipantList } from '../components/room/ParticipantList';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Video } from '../types';

export function Room() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const videoPlayerRef = useRef<VideoPlayerRef>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showVideoSelector, setShowVideoSelector] = useState(false);
  const [videos, setVideos] = useState<Video[]>([]);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [loadingVideos, setLoadingVideos] = useState(false);

  const { user } = useAuthStore();
  const {
    currentRoom,
    setCurrentRoom,
    setParticipants,
    setMessages,
    setSyncState,
    isHost,
    setIsHost,
    reset,
  } = useRoomStore();

  useEffect(() => {
    if (!roomId) return;
    const loadRoom = async () => {
      try {
        const data = await api.get<{ room: any }>(`/rooms/${roomId}`);
        setCurrentRoom(data.room);
        setParticipants(data.room.participants);
        setIsHost(data.room.hostId === user?.id);
        const msgData = await api.get<{ messages: any[] }>(`/rooms/${roomId}/messages`);
        setMessages(msgData.messages);
        const socket = connectSocket();
        socket.emit('room:join', { roomId });
        socket.emit('sync:requestState', { roomId });
        setLoading(false);
      } catch (err: any) {
        setError(err.message || 'Error al cargar la sala');
        setLoading(false);
      }
    };
    loadRoom();
    return () => { disconnectSocket(); reset(); };
  }, [roomId]);

  useEffect(() => {
    const socket = getSocket();
    const handleUserJoined = () => {
      if (roomId) api.get<{ room: any }>(`/rooms/${roomId}`).then((data) => setParticipants(data.room.participants));
    };
    const handleUserLeft = (data: { userId: string }) => {
      setParticipants(useRoomStore.getState().participants.filter((p) => p.userId !== data.userId));
    };
    const handleRoomClosed = () => { alert('La sala ha sido cerrada por el anfitrión'); navigate('/'); };
    const handleVideoChanged = (data: { videoId: string }) => {
      if (roomId) {
        api.get<{ room: any }>(`/rooms/${roomId}`).then((data) => {
          setCurrentRoom(data.room);
          setTimeout(() => { if (videoPlayerRef.current) videoPlayerRef.current.play(); }, 500);
        });
      }
    };
    const handleSyncState = (state: any) => {
      setSyncState(state);
      if (videoPlayerRef.current && state.videoId) {
        videoPlayerRef.current.seek(state.position);
        if (state.playing) videoPlayerRef.current.play();
        else videoPlayerRef.current.pause();
      }
    };
    socket.on('room:userJoined', handleUserJoined);
    socket.on('room:userLeft', handleUserLeft);
    socket.on('room:closed', handleRoomClosed);
    socket.on('room:videoChanged', handleVideoChanged);
    socket.on('sync:state', handleSyncState);
    return () => {
      socket.off('room:userJoined', handleUserJoined);
      socket.off('room:userLeft', handleUserLeft);
      socket.off('room:closed', handleRoomClosed);
      socket.off('room:videoChanged', handleVideoChanged);
      socket.off('sync:state', handleSyncState);
    };
  }, [roomId]);

  const handleLeaveRoom = async () => {
    if (!roomId) return;
    try {
      await api.post(`/rooms/${roomId}/leave`);
      getSocket().emit('room:leave', { roomId });
      disconnectSocket(); reset(); navigate('/');
    } catch (err: any) { setError(err.message || 'Error al salir'); }
  };

  const handleCloseRoom = async () => {
    if (!roomId) return;
    try { await api.post(`/rooms/${roomId}/close`); getSocket().emit('room:close', { roomId }); } catch (err: any) { setError(err.message); }
  };

  const handleSelectVideo = async (videoId: string) => {
    if (!roomId) return;
    try {
      await api.post(`/rooms/${roomId}/video`, { videoId });
      getSocket().emit('room:setVideo', { roomId, videoId });
      getSocket().emit('sync:setVideoId', { roomId, videoId });
      const data = await api.get<{ room: any }>(`/rooms/${roomId}`);
      setCurrentRoom(data.room);
      setTimeout(() => { if (videoPlayerRef.current) videoPlayerRef.current.play(); }, 500);
      setShowVideoSelector(false);
    } catch (err: any) { setError(err.message || 'Error al seleccionar video'); }
  };

  const loadVideos = async () => {
    setLoadingVideos(true);
    try { const data = await api.get<{ videos: Video[] }>('/videos'); setVideos(data.videos); } catch (err: any) { setError(err.message); } finally { setLoadingVideos(false); }
  };

  const openVideoSelector = () => { setShowVideoSelector(true); loadVideos(); };

  if (loading) return (<div className="min-h-screen flex items-center justify-center bg-gray-900"><div className="text-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div><p className="text-white">Cargando sala...</p></div></div>);
  if (error) return (<div className="min-h-screen flex items-center justify-center bg-gray-900"><div className="text-center"><p className="text-red-400 mb-4">{error}</p><Button onClick={() => navigate('/')}>Volver</Button></div></div>);
  if (!currentRoom) return (<div className="min-h-screen flex items-center justify-center bg-gray-900"><div className="text-center"><p className="text-white mb-4">Sala no encontrada</p><Button onClick={() => navigate('/')}>Volver</Button></div></div>);

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-white font-bold">VerPelisJuntos</h1>
            <span className="px-2 py-1 bg-gray-700 text-gray-300 text-sm font-mono rounded">{currentRoom.code}</span>
          </div>
          <div className="flex items-center gap-2">
            {isHost && <Button variant="danger" size="sm" onClick={handleCloseRoom}>Cerrar sala</Button>}
            <Button variant="secondary" size="sm" onClick={() => setShowLeaveModal(true)}>Salir</Button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 flex flex-col lg:flex-row gap-4">
        <div className="flex-1">
          {currentRoom.video ? (
            <VideoPlayer ref={videoPlayerRef} src={currentRoom.video.videoUrl} />
          ) : (
            <div className="aspect-video bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-700">
              <div className="text-center p-8">
                <div className="w-20 h-20 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-10 h-10 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                </div>
                <p className="text-gray-400 text-lg mb-2">No hay video seleccionado</p>
                <p className="text-gray-500 text-sm mb-6">{isHost ? 'Selecciona un video para empezar' : 'Esperando a que el anfitrión seleccione un video'}</p>
                <Button onClick={openVideoSelector} className="bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 border-0">Seleccionar video</Button>
              </div>
            </div>
          )}
          <div className="mt-4 flex items-center justify-between">
            <div>
              <h2 className="text-white font-semibold text-lg">{currentRoom.video?.title || 'Sin video'}</h2>
              {currentRoom.video?.description && <p className="text-gray-400 text-sm">{currentRoom.video.description}</p>}
            </div>
            <Button variant="secondary" size="sm" onClick={openVideoSelector}>{currentRoom.video ? 'Cambiar video' : 'Seleccionar video'}</Button>
          </div>
        </div>
        <div className="w-full lg:w-80 flex flex-col gap-4">
          <ParticipantList />
          <div className="flex-1 min-h-[300px]"><Chat /></div>
        </div>
      </main>

      <Modal isOpen={showVideoSelector} onClose={() => setShowVideoSelector(false)} title="Seleccionar Video">
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {loadingVideos ? (
            <div className="text-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500 mx-auto mb-2"></div><p className="text-gray-500 text-sm">Cargando videos...</p></div>
          ) : videos.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-pink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" /></svg>
              </div>
              <p className="text-gray-500 mb-2">No hay videos disponibles</p>
              <p className="text-gray-400 text-sm">Sube videos desde la página principal</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-500 mb-3">{videos.length} video{videos.length !== 1 ? 's' : ''} disponible{videos.length !== 1 ? 's' : ''}</p>
              {videos.map((video) => (
                <button key={video.id} onClick={() => handleSelectVideo(video.id)} className="w-full p-4 text-left hover:bg-pink-50 rounded-lg border-2 border-gray-200 hover:border-pink-300 transition-all group">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-purple-500 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 group-hover:text-pink-700 transition-colors truncate">{video.title}</p>
                      <p className="text-sm text-gray-500">{Math.floor(video.duration / 60)}:{(video.duration % 60).toString().padStart(2, '0')} min</p>
                      {video.description && <p className="text-xs text-gray-400 truncate mt-1">{video.description}</p>}
                    </div>
                  </div>
                </button>
              ))}
            </>
          )}
        </div>
      </Modal>

      <Modal isOpen={showLeaveModal} onClose={() => setShowLeaveModal(false)} title="Salir de la sala">
        <p className="text-gray-600 mb-6">¿Estás seguro de que quieres salir de la sala?</p>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={() => setShowLeaveModal(false)}>Cancelar</Button>
          <Button variant="danger" onClick={handleLeaveRoom}>Salir</Button>
        </div>
      </Modal>
    </div>
  );
}