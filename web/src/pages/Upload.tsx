import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { api } from '../lib/api';
import { extractYouTubeId, youtubeThumbnail } from '../lib/youtube';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Avatar } from '../components/ui/Avatar';

type Mode = 'upload' | 'youtube';

export function Upload() {
  const [mode, setMode] = useState<Mode>('youtube');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState('');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const youtubeId = extractYouTubeId(url);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      if (!title) setTitle(selectedFile.name.replace(/\.[^/.]+$/, ''));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setFile(droppedFile);
      if (!title) setTitle(droppedFile.name.replace(/\.[^/.]+$/, ''));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (mode === 'youtube') {
      if (!youtubeId) {
        setError('Pega una URL válida de YouTube');
        return;
      }

      setLoading(true);
      try {
        await api.post('/videos/youtube', {
          url: url.trim(),
          title: title.trim(),
          description: description.trim(),
          duration: parseInt(duration, 10) || 0,
        });
        navigate('/');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al agregar el video');
      } finally {
        setLoading(false);
      }
      return;
    }

    // --- Subida de archivo local ---
    if (!file) {
      setError('Selecciona un archivo de video');
      return;
    }

    if (!title.trim()) {
      setError('El título es requerido');
      return;
    }

    const parsedDuration = parseInt(duration, 10);
    if (!Number.isFinite(parsedDuration) || parsedDuration <= 0) {
      setError('Indica la duración en segundos (ej: 7200 para 2 horas)');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('video', file);
      formData.append('title', title.trim());
      formData.append('description', description.trim());
      formData.append('duration', String(parsedDuration));

      await api.upload('/videos', formData);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir el video');
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50">
      <header className="bg-white/80 backdrop-blur border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="text-xl font-bold bg-gradient-to-r from-pink-500 via-red-500 to-yellow-500 bg-clip-text text-transparent"
          >
            StreamTogether
          </button>
          <div className="flex items-center gap-4">
            <Avatar username={user?.username || ''} avatarUrl={user?.avatarUrl} size="sm" />
            <span className="text-sm font-medium text-gray-700">{user?.username}</span>
            <Button variant="ghost" size="sm" onClick={logout}>
              Cerrar sesión
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Agregar contenido</h2>
          <p className="text-gray-600">Pega un video de YouTube o sube un archivo propio</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
          {/* Selector de fuente */}
          <div className="grid grid-cols-2 gap-2 mb-6 bg-gray-100 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => setMode('youtube')}
              className={`py-2.5 rounded-md text-sm font-medium transition ${
                mode === 'youtube'
                  ? 'bg-white text-pink-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              YouTube
            </button>
            <button
              type="button"
              onClick={() => setMode('upload')}
              className={`py-2.5 rounded-md text-sm font-medium transition ${
                mode === 'upload'
                  ? 'bg-white text-pink-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Subir archivo
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {mode === 'youtube' ? (
              <>
                <Input
                  label="URL del video de YouTube"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  required
                />

                {youtubeId && (
                  <div className="flex gap-4 items-start p-3 border border-gray-200 rounded-lg bg-gray-50">
                    <img
                      src={youtubeThumbnail(youtubeId)}
                      alt="Miniatura del video"
                      className="w-32 rounded shadow-sm"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
                      }}
                    />
                    <div className="text-sm">
                      <p className="font-medium text-gray-900">Video válido</p>
                      <p className="text-gray-500 font-mono text-xs mt-1">ID: {youtubeId}</p>
                      <p className="text-gray-400 text-xs mt-2">
                        Anyone dentro del video, de los servidores de YouTube, puede reproducirlo.
                      </p>
                    </div>
                  </div>
                )}

                {url.trim() && !youtubeId && (
                  <p className="text-sm text-amber-600">
                    Esa URL no parece ser de YouTube. Ejemplos válidos: youtube.com/watch?v=...,
                    youtu.be/..., youtube.com/shorts/...
                  </p>
                )}
              </>
            ) : (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                  dragOver
                    ? 'border-pink-500 bg-pink-50'
                    : file
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-300 hover:border-pink-400'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                {file ? (
                  <div>
                    <p className="font-medium text-gray-900">{file.name}</p>
                    <p className="text-sm text-gray-500">{formatFileSize(file.size)}</p>
                    <p className="text-xs text-gray-400 mt-2">Click para cambiar</p>
                  </div>
                ) : (
                  <div>
                    <p className="font-medium text-gray-900">Arrastra tu video aquí</p>
                    <p className="text-sm text-gray-500">o click para seleccionar</p>
                    <p className="text-xs text-gray-400 mt-2">MP4, WebM, MOV (máx 500MB)</p>
                  </div>
                )}
              </div>
            )}

            <Input
              label="Título"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={mode === 'youtube' ? 'Se autogenera si lo dejas vacío' : 'Nombre del video'}
              required={mode === 'upload'}
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descripción del video (opcional)"
                rows={3}
                maxLength={2000}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 resize-none"
              />
            </div>

            {mode === 'upload' && (
              <Input
                label="Duración (en segundos)"
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="Ej: 7200 para 2 horas"
                min="1"
                required
              />
            )}

            <Button
              type="submit"
              loading={loading}
              className="w-full bg-gradient-to-r from-pink-500 to-red-500 hover:from-pink-600 hover:to-red-600 border-0"
            >
              {mode === 'youtube' ? 'Agregar video' : 'Subir video'}
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}