import { describe, it, expect } from 'vitest';
import {
  extractYouTubeId,
  youtubeEmbedUrl,
  youtubeThumbnail,
  parseYouTubeTimestamp,
} from '../src/utils/youtube';

describe('extractYouTubeId', () => {
  describe('formatos validos', () => {
    const casos: Array<[string, string, string]> = [
      ['watch clasico', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
      ['youtu.be corto', 'https://youtu.be/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
      ['embed', 'https://www.youtube.com/embed/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
      ['shorts', 'https://www.youtube.com/shorts/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
      ['live', 'https://www.youtube.com/live/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
      ['movil', 'https://m.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
      ['musica', 'https://music.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
      ['nocookie', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
      ['con timestamp', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s', 'dQw4w9WgXcQ'],
      ['con playlist', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLabc', 'dQw4w9WgXcQ'],
      ['http sin s', 'http://youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
      ['sin protocolo', 'youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
      ['ID suelto', 'dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
      ['ID con guion bajo', 'abc_def-123', 'abc_def-123'],
      ['ID con digitos y simbolos', 'a1B2c3D4e5F', 'a1B2c3D4e5F'],
    ];

    for (const [nombre, url, esperado] of casos) {
      it(`extrae el ID de: ${nombre}`, () => {
        expect(extractYouTubeId(url)).toBe(esperado);
      });
    }
  });

  describe('entradas que deben rechazarse', () => {
    const invalidos: Array<[string, string]> = [
      ['vacio', ''],
      ['solo espacios', '   '],
      ['null', ''],
      ['undefined', ''],
      ['basura', 'no-es-una-url'],
      ['otra plataforma', 'https://vimeo.com/123456789'],
      ['host disfrazado', 'https://evil.com/watch?v=dQw4w9WgXcQ'],
      ['subdominio falso', 'https://youtube.com.evil.io/watch?v=dQw4w9WgXcQ'],
      ['playlist sola', 'https://www.youtube.com/playlist?list=PLabc123'],
      ['canal', 'https://www.youtube.com/@canal'],
      ['ID muy corto', 'https://www.youtube.com/watch?v=corto'],
      ['ID muy largo', 'https://www.youtube.com/watch?v=demasiadolargoparavalidar'],
      ['caracteres invalidos', 'https://www.youtube.com/watch?v=abc123!@#$'],
      ['solo esquema', 'https://'],
    ];

    for (const [nombre, url] of invalidos) {
      it(`rechaza: ${nombre}`, () => {
        expect(extractYouTubeId(url)).toBeNull();
      });
    }
  });

  it('rechaza null y undefined', () => {
    expect(extractYouTubeId(null)).toBeNull();
    expect(extractYouTubeId(undefined)).toBeNull();
  });

  it('no confunde un host que termina en youtube', () => {
    // "notyoutube.com" contiene "youtube" pero no es YouTube
    expect(extractYouTubeId('https://notyoutube.com/watch?v=dQw4w9WgXcQ')).toBeNull();
  });

  it('acepta el mismo ID escrito de varias formas', () => {
    const formas = [
      'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
      'https://youtu.be/aqz-KE-bpKQ',
      'https://www.youtube.com/embed/aqz-KE-bpKQ',
      'aqz-KE-bpKQ',
    ];

    const ids = formas.map(extractYouTubeId);
    expect(new Set(ids).size).toBe(1);
    expect(ids[0]).toBe('aqz-KE-bpKQ');
  });
});

describe('youtubeEmbedUrl', () => {
  it('usa youtube-nocookie para no rastrear al usuario', () => {
    const url = youtubeEmbedUrl('dQw4w9WgXcQ');
    expect(url).toContain('youtube-nocookie.com');
    expect(url).toContain('enablejsapi=1');
  });

  it('incluye el ID del video', () => {
    expect(youtubeEmbedUrl('dQw4w9WgXcQ')).toContain('dQw4w9WgXcQ');
  });

  it('no incluye la playlist ni el video recomendado', () => {
    const url = youtubeEmbedUrl('dQw4w9WgXcQ');
    expect(url).not.toContain('list=');
    expect(url).toContain('rel=0');
  });
});

describe('youtubeThumbnail', () => {
  it('construye la URL de la miniatura', () => {
    expect(youtubeThumbnail('dQw4w9WgXcQ')).toBe('https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
  });
});

describe('parseYouTubeTimestamp', () => {
  it('interpreta 1h2m3s', () => {
    expect(parseYouTubeTimestamp('1h2m3s')).toBe(3723);
  });

  it('interpreta 2:03', () => {
    expect(parseYouTubeTimestamp('2:03')).toBe(123);
  });

  it('interpreta segundos sueltos', () => {
    expect(parseYouTubeTimestamp('90')).toBe(90);
  });

  it('devuelve 0 si no puede interpretar', () => {
    expect(parseYouTubeTimestamp(null)).toBe(0);
    expect(parseYouTubeTimestamp('')).toBe(0);
    expect(parseYouTubeTimestamp('abc')).toBe(0);
  });
});