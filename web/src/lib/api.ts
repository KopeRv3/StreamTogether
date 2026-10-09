import { useAuthStore } from '../stores/authStore';

const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';

/** Normaliza cualquier respuesta (JSON o texto) en algo con `error`. */
async function parseBody(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();

  if (!text) return {};

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    // El servidor devolvió HTML o texto plano (proxy, 502, etc.)
    return { error: `Respuesta inesperada del servidor (HTTP ${response.status})` };
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit & { rawBody?: BodyInit } = {},
): Promise<T> {
  const token = useAuthStore.getState().token;

  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) || {}),
  };

  // Solo poner Content-Type si hay cuerpo; en FormData lo define el navegador
  if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) headers['Authorization'] = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${API_URL}/api${endpoint}`, {
      ...options,
      headers,
    });
  } catch {
    throw new Error('No se pudo conectar con el servidor. Revisa tu conexión.');
  }

  const data = await parseBody(response);

  if (!response.ok) {
    throw new Error(
      (data.error as string) || `Error ${response.status} en la petición`,
    );
  }

  return data as T;
}

export const api = {
  get: <T>(endpoint: string) => request<T>(endpoint),

  // El body es opcional: hay endpoints como /rooms/:id/leave que no lo usan
  post: <T>(endpoint: string, body?: unknown) =>
    request<T>(endpoint, {
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
    }),

  put: <T>(endpoint: string, body?: unknown) =>
    request<T>(endpoint, {
      method: 'PUT',
      body: body === undefined ? undefined : JSON.stringify(body),
    }),

  delete: <T>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' }),

  upload: async <T>(endpoint: string, formData: FormData): Promise<T> => {
    const token = useAuthStore.getState().token;

    const response = await fetch(`${API_URL}/api${endpoint}`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });

    const data = await parseBody(response);

    if (!response.ok) {
      throw new Error((data.error as string) || `Error ${response.status} al subir el archivo`);
    }

    return data as T;
  },
};