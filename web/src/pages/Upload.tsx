import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { api } from '../lib/api';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Avatar } from '../components/ui/Avatar';

export function Upload() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      if (!title) {
        setTitle(selectedFile.name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setFile(droppedFile);
      if (!title) {
        setTitle(droppedFile.name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!file) {
      setError('Selecciona un archivo de video');
      return;
    }

    if (!title.trim()) {
      setError('El título es requerido');
      return;
    }

    if (!duration || parseInt(duration) <= 0) {
      setError('La duración es requerida (en segundos)');
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('video', file);
      formData.append('title', title.trim());
      formData.append('description', description.trim() || '');
      formData.append('duration', duration);

      await api.upload('/videos', formData);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Error al subir el video');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="text-xl font-bold bg-gradient-to-r from-pink-500 via-red-500 to-yellow-500 bg-clip-text text-transparent"
          >
            VerPelisJuntos
          </button>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Avatar username={user?.username || ''} avatarUrl={user?.avatarUrl} size="sm" />
              <span className="text-sm font-medium text-gray-700">{user?.username}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              Cerrar sesión
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-2xl mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Subir Video</h2>
          <p className="text-gray-600">Agrega contenido para ver en tus salas</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* File drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                dragOver
                  ? 'border-pink-500 bg-pink-50'
                  : file
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-300 hover:border-pink-400 hover:bg-pink-50/50'
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
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="font-medium text-gray-900">{file.name}</p>
                  <p className="text-sm text-gray-500">{formatFileSize(file.size)}</p>
                  <p className="text-xs text-gray-400 mt-2">Click para cambiar</p>
                </div>
              ) : (
                <div>
                  <div className="w-16 h-16 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <p className="font-medium text-gray-900">Arrastra tu video aquí</p>
                  <p className="text-sm text-gray-500">o click para seleccionar</p>
                  <p className="text-xs text-gray-400 mt-2">MP4, WebM, MOV (máx 500MB)</p>
                </div>
              )}
            </div>

            {/* Title */}
            <Input
              label="Título"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nombre de la película o video"
              required
            />

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descripción
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descripción del video (opcional)"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent resize-none"
              />
            </div>

            {/* Duration */}
            <Input
              label="Duración (en segundos)"
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="Ej: 7200 para 2 horas"
              min="1"
              required
            />

            {/* Submit */}
            <Button
              type="submit"
              loading={loading}
              className="w-full bg-gradient-to-r from-pink-500 to-red-500 hover:from-pink-600 hover:to-red-600 border-0"
            >
              Subir Video
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}