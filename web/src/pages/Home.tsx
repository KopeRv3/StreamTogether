import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { api } from '../lib/api';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Avatar } from '../components/ui/Avatar';

export function Home() {
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleCreateRoom = async () => {
    setLoading(true);
    setError('');

    try {
      const data = await api.post<{ room: any }>('/rooms');
      navigate(`/room/${data.room.id}`);
    } catch (err: any) {
      setError(err.message || 'Error al crear la sala');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;

    setLoading(true);
    setError('');

    try {
      const data = await api.post<{ room: any }>('/rooms/join', {
        code: joinCode.trim().toUpperCase(),
      });
      navigate(`/room/${data.room.id}`);
    } catch (err: any) {
      setError(err.message || 'Error al unirse a la sala');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold bg-gradient-to-r from-pink-500 via-red-500 to-yellow-500 bg-clip-text text-transparent">VerPelisJuntos</h1>
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
      <main className="max-w-4xl mx-auto px-4 py-12 bg-gradient-to-br from-pink-50 via-white to-purple-50 min-h-[calc(100vh-73px)]">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            ¿Qué quieres hacer hoy?
          </h2>
          <p className="text-gray-600 mb-2">
            Crea una sala para ver con amigos o únete a una existente
          </p>
          <p className="text-lg font-medium bg-gradient-to-r from-pink-500 via-red-500 to-yellow-500 bg-clip-text text-transparent">
            Para mi y mi Guerita hermosa
          </p>
        </div>

        <div className="mb-6">
            <button
              onClick={() => navigate('/upload')}
              className="w-full p-4 bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 rounded-xl text-white font-semibold hover:shadow-lg hover:scale-[1.02] transition-all flex items-center justify-center gap-3"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              Subir Video
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
          {/* Create room */}
          <div className="bg-gradient-to-br from-pink-50 to-red-50 rounded-xl border-2 border-pink-200 p-6 hover:shadow-lg hover:border-pink-300 transition-all">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-pink-500 to-red-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Crear Sala</h3>
              <p className="text-gray-600 text-sm mb-6">
                Crea una nueva sala y comparte el código con tus amigos
              </p>
              <Button onClick={handleCreateRoom} loading={loading} className="w-full bg-gradient-to-r from-pink-500 to-red-500 hover:from-pink-600 hover:to-red-600 border-0">
                Crear Nueva Sala
              </Button>
            </div>
          </div>

          {/* Join room */}
          <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl border-2 border-purple-200 p-6 hover:shadow-lg hover:border-purple-300 transition-all">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Unirse a Sala</h3>
              <p className="text-gray-600 text-sm mb-6">
                Ingresa el código de 6 caracteres para unirte
              </p>
              <form onSubmit={handleJoinRoom} className="space-y-3">
                <Input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="ABC123"
                  maxLength={6}
                  className="text-center text-lg font-mono tracking-widest"
                />
                <Button type="submit" loading={loading} className="w-full bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 border-0">
                  Unirse
                </Button>
              </form>
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-center">
            {error}
          </div>
        )}
      </main>
    </div>
  );
}