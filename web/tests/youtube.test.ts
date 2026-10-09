import { describe, it, expect } from 'vitest';
import { extractYouTubeId, parseDurationFromTitle } from '../src/lib/youtube';

/**
 * Esta es la copia del cliente de la funcion del servidor.
 * Si divergen, el usuario veria una previsualizacion valida en el formulario
 * y recibiria un 400 al guardar, asi que hay que probarlas por separado.
 */
describe('extractYouTubeId (cliente)', () => {
  const validos: Array<[string, string]> = [
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/embed/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/shorts/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/live/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=42s', 'dQw4w9WgXcQ'],
    ['youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
  ];

  for (const [url, esperado] of validos) {
    it(`acepta ${url}`, () => {
      expect(extractYouTubeId(url)).toBe(esperado);
    });
  }

  const invalidos: Array<[string, string]> = [
    ['vacio', ''],
    ['basura', 'no-es-una-url'],
    ['otra plataforma', 'https://vimeo.com/123456'],
    ['host disfrazado', 'https://youtube.com.evil.io/watch?v=dQw4w9WgXcQ'],
    ['playlist', 'https://www.youtube.com/playlist?list=PL123'],
    ['ID corto', 'https://www.youtube.com/watch?v=corto'],
  ];

  for (const [nombre, url] of invalidos) {
    it(`rechaza ${nombre}`, () => {
      expect(extractYouTubeId(url)).toBeNull();
    });
  }

  it('rechaza null y undefined', () => {
    expect(extractYouTubeId(null)).toBeNull();
    expect(extractYouTubeId(undefined)).toBeNull();
  });
});

describe('parseDurationFromTitle', () => {
  it('extrae mm:ss del titulo', () => {
    expect(parseDurationFromTitle('Video oficial 12:34')).toBe(754);
    expect(parseDurationFromTitle('Concert 45:00')).toBe(2700);
  });

  it('funciona aunque el tiempo este entre parentesis o corchetes', () => {
    expect(parseDurationFromTitle('Concert (45:00)')).toBe(2700);
    expect(parseDurationFromTitle('[Official] 3:20')).toBe(200);
    expect(parseDurationFromTitle('Video - 10:05 - HD')).toBe(605);
  });

  it('devuelve 0 si no hay duracion reconocible', () => {
    expect(parseDurationFromTitle('Un video normal')).toBe(0);
    expect(parseDurationFromTitle(null)).toBe(0);
    expect(parseDurationFromTitle(undefined)).toBe(0);
    expect(parseDurationFromTitle('')).toBe(0);
  });

  it('rechaza valores que no son un tiempo valido', () => {
    expect(parseDurationFromTitle('Reloj 12:75')).toBe(0);
    expect(parseDurationFromTitle('Reloj 99:99')).toBe(0);
    expect(parseDurationFromTitle('Version 2024:10')).toBe(0);
  });

  it('toma el primer tiempo que encuentra', () => {
    expect(parseDurationFromTitle('12:34 de duracion, empieza a las 8:00')).toBe(754);
  });
});