import { describe, it, expect } from 'vitest';
import {
  normalizeRoomCode,
  isValidRoomCode,
  remainingRoomCodeChars,
  ROOM_CODE_LENGTH,
} from '../src/lib/roomCode';

describe('normalizeRoomCode', () => {
  it('pasa a mayusculas', () => {
    expect(normalizeRoomCode('abc123')).toBe('ABC123');
  });

  it('quita espacios y guiones', () => {
    expect(normalizeRoomCode('ab c-123')).toBe('ABC123');
    expect(normalizeRoomCode('  ABC123  ')).toBe('ABC123');
  });

  it('deja intacto un codigo ya valido', () => {
    expect(normalizeRoomCode('ABC123')).toBe('ABC123');
  });
});

describe('isValidRoomCode', () => {
  it('acepta codigos validos', () => {
    // ABC123: A,B,C validos; 1 NO es valido (se confunde con I)
    expect(isValidRoomCode('ABC234')).toBe(true);
    expect(isValidRoomCode('ZZZZZZ')).toBe(true);
    expect(isValidRoomCode('234567')).toBe(true);
  });

  it('rechaza longitud incorrecta', () => {
    expect(isValidRoomCode('ABC12')).toBe(false);
    expect(isValidRoomCode('ABC1234')).toBe(false);
    expect(isValidRoomCode('')).toBe(false);
  });

  it('rechaza caracteres que el servidor nunca genera', () => {
    // 0, 1, I y O se excluyen por confusion visual/sonora
    expect(isValidRoomCode('ABC034')).toBe(false);
    expect(isValidRoomCode('ABC134')).toBe(false);
    expect(isValidRoomCode('ABCI34')).toBe(false);
    expect(isValidRoomCode('ABCO34')).toBe(false);
  });

  it('rechaza minusculas', () => {
    expect(isValidRoomCode('abc123')).toBe(false);
  });
});

describe('remainingRoomCodeChars', () => {
  it('indica cuantos faltan para completar', () => {
    expect(remainingRoomCodeChars('')).toBe(ROOM_CODE_LENGTH);
    expect(remainingRoomCodeChars('AB')).toBe(4);
    expect(remainingRoomCodeChars('ABC123')).toBe(0);
  });

  it('nunca da negativo si se pasa de largo', () => {
    expect(remainingRoomCodeChars('ABC123456')).toBe(0);
  });

  it('ignora los caracteres que se descartan', () => {
    expect(remainingRoomCodeChars('A-B C')).toBe(3);
  });
});