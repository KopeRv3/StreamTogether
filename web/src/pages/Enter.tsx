import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import { Button } from '../components/ui/Button';

const SUGERENCIAS = ['Ana', 'Beto', 'Carla', 'Denzel'];

/**
 * Unica pantalla de acceso: se escribe un nombre y se entra.
 * No hay correo, ni contraseña, ni registro previo.
 */
export function Enter() {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  const canSubmit = username.trim().length >= 2 && !loading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setError('');

    try {
      const data = await api.post<{ user: any; token: string }>('/auth/guest', {
        username: username.trim(),
      });

      setAuth(data.user, data.token);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo entrar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-pink-500 via-red-500 to-yellow-500 bg-clip-text text-transparent mb-2">
            StreamTogether
          </h1>
          <p className="text-gray-500 text-sm">Ve videos sincronizados con quien quieras</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-lg border border-gray-200 p-5 sm:p-6"
        >
          <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
            ¿Cómo te llamas?
          </label>

          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Escribe tu nombre"
            autoComplete="off"
            autoCapitalize="words"
            autoFocus
            maxLength={30}
            // 16px evita que iOS haga zoom al enfocar
            className="w-full px-4 py-3.5 text-base sm:text-lg border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
          />

          {error && (
            <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={!canSubmit}
            loading={loading}
            className="w-full mt-4 py-3.5 text-base bg-gradient-to-r from-pink-500 to-red-500 hover:from-pink-600 hover:to-red-600 border-0"
          >
            Entrar
          </Button>

          <div className="mt-5 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400 text-center mb-2">O prueba con</p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGERENCIAS.map((nombre) => (
                <button
                  key={nombre}
                  type="button"
                  onClick={() => setUsername(nombre)}
                  className="px-3 py-1.5 text-sm rounded-full bg-gray-100 hover:bg-pink-100 hover:text-pink-700 transition-colors"
                >
                  {nombre}
                </button>
              ))}
            </div>
          </div>
        </form>

        <p className="mt-6 text-center text-xs text-gray-400 leading-relaxed">
          No hace falta registro. Tu nombre solo se usa para reconocerte
          <br />
          dentro de la sala.
        </p>
      </div>
    </div>
  );
}
