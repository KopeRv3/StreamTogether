/**
 * Utilidades para trabajar con URLs de YouTube.
 *
 * Acepta todos los formatos habituales y devuelve el ID de 11 caracteres:
 *   https://www.youtube.com/watch?v=dQw4w9WgXcQ
 *   https://youtu.be/dQw4w9WgXcQ
 *   https://www.youtube.com/embed/dQw4w9WgXcQ
 *   https://www.youtube.com/shorts/dQw4w9WgXcQ
 *   https://www.youtube.com/live/dQw4w9WgXcQ
 *   https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=42s
 *   dQw4w9WgXcQ   (ID suelto)
 */

// IDs de YouTube siempre tienen 11 caracteres de [A-Za-z0-9_-]
const YT_ID = /^[A-Za-z0-9_-]{11}$/;

const YT_HOSTS = [
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
  'youtu.be',
  'www.youtu.be',
];

export function extractYouTubeId(input: string | null | undefined): string | null {
  if (!input) return null;

  const trimmed = input.trim();
  if (!trimmed) return null;

  // Si ya es un ID suelto
  if (YT_ID.test(trimmed)) return trimmed;

  // Quitar protocolo si el usuario lo pegó sin https://
  let url: URL;
  try {
    url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase();
  if (!YT_HOSTS.includes(host)) return null;

  const segments = url.pathname.split('/').filter(Boolean);

  // youtu.be/<id>
  if (host.endsWith('youtu.be') && segments.length >= 1) {
    return YT_ID.test(segments[0]) ? segments[0] : null;
  }

  // /embed/<id>  /shorts/<id>  /live/<id>  /v/<id>
  if (segments.length >= 2) {
    const [kind, maybeId] = segments;
    if (['embed', 'shorts', 'live', 'v'].includes(kind) && YT_ID.test(maybeId)) {
      return maybeId;
    }
  }

  // /watch?v=<id>
  const v = url.searchParams.get('v');
  if (v && YT_ID.test(v)) return v;

  return null;
}

/** URL canónica de embed, sin timestamps ni parámetros de tracking. */
export function youtubeEmbedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}?enablejsapi=1&rel=0&modestbranding=1`;
}

/** URL del thumbnail por defecto de YouTube. */
export function youtubeThumbnail(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

/**
 * Convierte un timestamp de YouTube (`1h2m3s`, `2:03`, `90`) a segundos.
 * Devuelve 0 si no se puede interpretar.
 */
export function parseYouTubeTimestamp(start: string | null): number {
  if (!start) return 0;
  const s = start.trim();
  if (!s) return 0;

  if (/^\d+$/.test(s)) return parseInt(s, 10);

  // Formato 1h2m3s
  const hms = /^(\d+h)?(\d+m)?(\d+s)?$/i.exec(s);
  if (hms && (hms[1] || hms[2] || hms[3])) {
    const h = parseInt((hms[1] || '0h').replace('h', ''), 10);
    const m = parseInt((hms[2] || '0m').replace('m', ''), 10);
    const sec = parseInt((hms[3] || '0s').replace('s', ''), 10);
    return h * 3600 + m * 60 + sec;
  }

  // Formato 2:03
  const ms = /^(?:(\d+):)?(\d{1,2})$/.exec(s);
  if (ms) {
    const m = parseInt(ms[1] || '0', 10);
    const sec = parseInt(ms[2], 10);
    return m * 60 + sec;
  }

  return 0;
}
