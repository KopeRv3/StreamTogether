import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { api } from '../lib/api';
import { normalizeRoomCode, remainingRoomCodeChars, ROOM_CODE_LENGTH } from '../lib/roomCode';
import { Button } from '../components/ui/Button';
import { Avatar } from '../components/ui/Avatar';
import type { Room } from '../types';

export function Home() {
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState<'crear' | 'unirse' | null>(null);

  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const limpio = normalizeRoomCode(codigo);
  const faltan = remainingRoomCodeChars(codigo);

  const crearSala = async () => {
    setCargando('crear');
    setError('');
    try {
      const data = await api.post<{ room: Room }>('/rooms');
      navigate(`/sala/${data.room.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la sala');
    } finally {
      setCargando(null);
    }
  };

  const unirse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (limpio.length !== ROOM_CODE_LENGTH || cargando) return;

    setCargando('unirse');
    setError('');

    try {
      const data = await api.post<{ room: Room }>('/rooms/join', { code: limpio });
      navigate(`/sala/${data.room.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo entrar a la sala');
    } finally {
      setCargando(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 pb-24">
      <header className="bg-white/80 backdrop-blur border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold bg-gradient-to-r from-pink-500 via-red-500 to-yellow-500 bg-clip-text text-transparent">
            StreamTogether
          </h1>
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

      <main className="max-w-2xl mx-auto px-4 py-8">
        <p className="text-center text-gray-600 mb-8">
          Hola <span className="font-semibold text-gray-900">{user?.username}</span>. ¿Qué quieres
          hacer?
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm text-center">
            {error}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Crear */}
          <button
            onClick={crearSala}
            disabled={cargando !== null}
            className="group bg-gradient-to-br from-pink-50 to-red-50 rounded-2xl border-2 border-pink-200 p-6 text-left hover:border-pink-300 hover:shadow-lg transition-all disabled:opacity-60"
          >
            <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-red-500 rounded-full flex items-center justify-center mb-3 text-white text-2xl">
              +
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Crear sala</h2>
            <p className="text-sm text-gray-600 mb-4">
              Crea una sala nueva y comparte el código con tus amigos
            </p>
            <span className="inline-block px-4 py-2.5 rounded-lg bg-pink-500 text-white text-sm font-medium group-hover:bg-pink-600 transition-colors">
              {cargando === 'crear' ? 'Creando...' : 'Crear'}
            </span>
          </button>

          {/* Unirse */}
          <form
            onSubmit={unirse}
            className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl border-2 border-purple-200 p-6 flex flex-col"
          >
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-full flex items-center justify-center mb-3 text-white text-xl">
              ⇥
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Unirse a una sala</h2>
            <p className="text-sm text-gray-600 mb-4">
              Escribe el código de {ROOM_CODE_LENGTH} letras que te compartieron
            </p>

            <input
              type="text"
              value={codigo}
              onChange={(e) =>
                setCodigo(normalizeRoomCode(e.target.value).slice(0, ROOM_CODE_LENGTH))
              }
              placeholder="ABC234"
              maxLength={ROOM_CODE_LENGTH}
              inputMode="text"
              autoCapitalize="characters"
              autoComplete="off"
              className="w-full px-4 py-3.5 text-center text-2xl font-mono tracking-[0.3em] border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
            />

            <p className="text-center text-xs text-gray-400 mt-2 h-4">
              {faltan > 0 ? `Faltan ${faltan} caracteres` : 'Listo para entrar'}
            </p>

            <Button
              type="submit"
              disabled={limpio.length !== ROOM_CODE_LENGTH || cargando !== null}
              loading={cargando === 'unirse'}
              className="w-full mt-auto py-3 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 border-0"
            >
              Unirse
            </Button>
          </form>
        </div>

        <button
          onClick={() => navigate('/biblioteca')}
          className="mt-8 w-full text-center text-sm text-gray-500 hover:text-pink-600 transition-colors"
        >
          Administrar biblioteca de videos →
        </button>
      </main>

      {/* Navegación inferior para celular */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 sm:hidden">
        <div className="flex">
          <button
            onClick={() => navigate('/')}
            className="flex-1 py-3 text-xs font-medium text-pink-600 flex flex-col items-center gap-0.5"
          >
            <span className="text-lg">🏠</span>
            Inicio
          </button>
          <button
            onClick={() => navigate('/biblioteca')}
            className="flex-1 py-3 text-xs font-medium text-gray-500 flex flex-col items-center gap-0.5"
          >
            <span className="text-lg">🎬</span>
            Biblioteca
          </button>
        </div>
      </nav>
    </div>
  );
}
