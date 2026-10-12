import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { extractYouTubeId, youtubeThumbnail } from '../lib/youtube';
import { useAuthStore } from '../stores/authStore';
import { Button } from '../components/ui/Button';
import { Avatar } from '../components/ui/Avatar';
import type { Video } from '../types';

type Vista = 'youtube' | 'archivo';

export function Library() {
  const [vista, setVista] = useState<Vista>('youtube');
  const [url, setUrl] = useState('');
  const [titulo, setTitulo] = useState('');
  const [videos, setVideos] = useState<Video[]>([]);
  const [cargando, setCargando] = useState(true);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const youtubeId = extractYouTubeId(url);

  const cargar = async () => {
    setCargando(true);
    try {
      const data = await api.get<{ videos: Video[] }>('/videos');
      setVideos(data.videos);
    } catch {
      setError('No se pudo cargar la biblioteca');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    void cargar();
  }, []);

  const pegarDesdePortapapeles = async () => {
    try {
      const texto = await navigator.clipboard.readText();
      if (texto) setUrl(texto.trim());
    } catch {
      setAviso('El navegador no dejó leer el portapapeles. Pega la URL a mano.');
      setTimeout(() => setAviso(''), 4000);
    }
  };

  const agregarYouTube = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!youtubeId || subiendo) return;

    setSubiendo(true);
    setError('');

    try {
      await api.post('/videos/youtube', {
        url: url.trim(),
        title: titulo.trim() || undefined,
      });
      setUrl('');
      setTitulo('');
      await cargar();
      setAviso('Video agregado. Ya puedes elegirlo en una sala.');
      setTimeout(() => setAviso(''), 3500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo agregar');
    } finally {
      setSubiendo(false);
    }
  };

  const eliminar = async (video: Video) => {
    if (!confirm(`¿Quitar "${video.title}" de la biblioteca?`)) return;

    try {
      await api.delete(`/videos/${video.id}`);
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 pb-24">
      <header className="bg-white/80 backdrop-blur border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="text-lg font-bold bg-gradient-to-r from-pink-500 via-red-500 to-yellow-500 bg-clip-text text-transparent"
          >
            StreamTogether
          </button>
          <div className="flex items-center gap-3">
            <Avatar username={user?.username ?? ''} size="sm" />
            <button
              onClick={logout}
              className="text-sm text-gray-500 hover:text-red-600 transition-colors"
            >
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Biblioteca</h1>
        <p className="text-gray-500 text-sm mb-5">
          Pega la URL de un video de YouTube para verlo dentro de la app
        </p>

        {/* Selector */}
        <div className="grid grid-cols-2 gap-1 bg-gray-100 p-1 rounded-xl mb-4">
          <button
            onClick={() => setVista('youtube')}
            className={`py-2.5 rounded-lg text-sm font-medium transition ${
              vista === 'youtube' ? 'bg-white text-pink-600 shadow-sm' : 'text-gray-600'
            }`}
          >
            YouTube
          </button>
          <button
            onClick={() => setVista('archivo')}
            className={`py-2.5 rounded-lg text-sm font-medium transition ${
              vista === 'archivo' ? 'bg-white text-pink-600 shadow-sm' : 'text-gray-600'
            }`}
          >
            Subir archivo
          </button>
        </div>

        {aviso && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
            {aviso}
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* YouTube */}
        {vista === 'youtube' ? (
          <form
            onSubmit={agregarYouTube}
            className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-5 mb-6"
          >
            <label className="block text-sm font-medium text-gray-700 mb-2">URL del video</label>

            <div className="flex gap-2">
              <input
                type="url"
                inputMode="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
                className="flex-1 min-w-0 px-3.5 py-3 text-base border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={pegarDesdePortapapeles}
                className="shrink-0"
                title="Pegar desde el portapapeles"
              >
                Pegar
              </Button>
            </div>

            {url.trim() && youtubeId && (
              <div className="mt-3 flex gap-3 items-center p-3 border border-gray-200 rounded-xl bg-gray-50">
                <img
                  src={youtubeThumbnail(youtubeId)}
                  alt=""
                  className="w-24 h-14 object-cover rounded flex-shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-green-700">Video válido</p>
                  <p className="text-xs text-gray-500 font-mono truncate">{youtubeId}</p>
                </div>
              </div>
            )}

            {url.trim() && !youtubeId && (
              <p className="mt-2 text-sm text-amber-600">Esa no parece ser una URL de YouTube.</p>
            )}

            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Título (opcional)"
              maxLength={200}
              className="mt-3 w-full px-3.5 py-3 text-base border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500"
            />

            <Button
              type="submit"
              disabled={!youtubeId || subiendo}
              loading={subiendo}
              className="w-full mt-4 py-3 bg-gradient-to-r from-pink-500 to-red-500 hover:from-pink-600 hover:to-red-600 border-0"
            >
              Agregar a la biblioteca
            </Button>
          </form>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 mb-6 text-center">
            <p className="text-gray-500 text-sm mb-2">
              Subir archivos requiere almacenamiento en el servidor.
            </p>
            <p className="text-xs text-gray-400">
              En el despliegue público usa YouTube: es más rápido y no ocupa espacio.
            </p>
          </div>
        )}

        {/* Lista */}
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          En la biblioteca ({videos.length})
        </h2>

        {cargando ? (
          <div className="text-center py-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500 mx-auto" />
          </div>
        ) : videos.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <div className="text-4xl mb-2">🎬</div>
            <p>Aún no hay videos. Pega una URL de YouTube arriba.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {videos.map((video) => (
              <li
                key={video.id}
                className="flex items-center gap-3 bg-white rounded-xl border border-gray-200 p-3"
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

                {video.ownerId === user?.id && (
                  <button
                    onClick={() => eliminar(video)}
                    className="shrink-0 p-2 text-gray-400 hover:text-red-600 transition-colors"
                    aria-label={`Eliminar ${video.title}`}
                  >
                    🗑
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
