/**
 * Carga la IFrame Player API de YouTube una sola vez y expone tipos mínimos.
 *
 * Se usa la API (y no un <iframe> pelado) porque para sincronizar la
 * reproducción necesitamos leer y escribir `currentTime`, algo que un iframe
 * normal no permite por motivos de seguridad de origen.
 */

export interface YTPlayer {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  destroy: () => void;
  addEventListener: (event: string, cb: () => void) => void;
  removeEventListener: (event: string, cb: () => void) => void;
}

export interface YTPlayerOptions {
  videoId: string;
  playerVars?: Record<string, string | number>;
  events?: {
    onReady?: (event: { target: YTPlayer }) => void;
    onStateChange?: (event: { target: YTPlayer; data: number }) => void;
    onError?: (event: { data: number }) => void;
  };
}

declare global {
  interface Window {
    YT?: {
      Player: new (element: HTMLElement | string, options: YTPlayerOptions) => YTPlayer;
      PlayerState: Record<string, number>;
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

/** Estados públicos del player (los que nos importan). */
export const YT_STATE = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
} as const;

let apiPromise: Promise<void> | null = null;

/**
 * Carga el script de la IFrame API. Si ya está cargado (o se está cargando)
 * devuelve la misma promesa, así que se puede llamar varias veces.
 */
export function loadYouTubeApi(): Promise<void> {
  if (apiPromise) return apiPromise;

  apiPromise = new Promise<void>((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('YouTube API solo funciona en el navegador'));
      return;
    }

    // Ya estaba disponible (por ejemplo tras una recarga en caliente de Vite)
    if (window.YT && typeof window.YT.Player === 'function') {
      resolve();
      return;
    }

    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve();
    };

    const existing = document.querySelector<HTMLScriptElement>('script[data-youtube-iframe-api]');
    if (existing) return; // ya se está cargando, esperamos al callback

    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    tag.async = true;
    tag.dataset.youtubeIframeApi = 'true';
    tag.onerror = () => {
      apiPromise = null;
      reject(new Error('No se pudo cargar la API de YouTube. Revisa tu conexión.'));
    };
    document.head.appendChild(tag);
  });

  return apiPromise;
}

/**
 * Extrae el ID de 11 caracteres de cualquier URL de YouTube.
 * Espejo de la función del servidor para poder previsualizar la URL
 * antes de guardarla.
 */
export function extractYouTubeId(input: string | null | undefined): string | null {
  if (!input) return null;

  const trimmed = input.trim();
  if (!trimmed) return null;

  const YT_ID = /^[A-Za-z0-9_-]{11}$/;
  if (YT_ID.test(trimmed)) return trimmed;

  let url: URL;
  try {
    url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase();
  const allowed = [
    'youtube.com',
    'www.youtube.com',
    'm.youtube.com',
    'music.youtube.com',
    'youtube-nocookie.com',
    'www.youtube-nocookie.com',
    'youtu.be',
    'www.youtu.be',
  ];

  if (!allowed.includes(host)) return null;

  const segments = url.pathname.split('/').filter(Boolean);

  if (host.endsWith('youtu.be') && segments.length >= 1) {
    return YT_ID.test(segments[0]) ? segments[0] : null;
  }

  if (segments.length >= 2) {
    const [kind, maybeId] = segments;
    if (['embed', 'shorts', 'live', 'v'].includes(kind) && YT_ID.test(maybeId)) {
      return maybeId;
    }
  }

  const v = url.searchParams.get('v');
  return v && YT_ID.test(v) ? v : null;
}

export function youtubeThumbnail(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

/**
 * Duración aproximada a partir del título, p. ej. "Video oficial 12:34".
 *
 * Acepta el tiempo rodeado de cualquier cosa (paréntesis, corchetes, guiones),
 * no solo espacios: "Concert (45:00)" también debe funcionar.
 */
export function parseDurationFromTitle(title: string | null | undefined): number {
  if (!title) return 0;

  const match = /(?:^|[^\d:])(\d{1,3}):([0-5]\d)(?!\d)/.exec(title);
  if (!match) return 0;

  const minutes = parseInt(match[1], 10);
  const seconds = parseInt(match[2], 10);

  // Descarta horas, tiempos invertidos o clock (12:75)
  if (minutes > 599 || seconds > 59) return 0;

  return minutes * 60 + seconds;
}
