import { describe, it, expect } from 'vitest';
import { generateRoomCode } from '../src/utils/codeGenerator';

/**
 * El alfabeto esta pensado para dictar codigos por voz, asi que excluye
 * los caracteres que se confunden entre si al pronunciarlos.
 */
const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
/** Lo que el alfabeto excluye deliberadamente: 0/O y 1/I se confunden. */
const EXCLUIDOS = ['0', '1', 'I', 'O'];

describe('generateRoomCode', () => {
  it('produce un codigo de 6 caracteres por defecto', () => {
    expect(generateRoomCode()).toHaveLength(6);
  });

  it('respeta la longitud solicitada', () => {
    expect(generateRoomCode(4)).toHaveLength(4);
    expect(generateRoomCode(10)).toHaveLength(10);
    expect(generateRoomCode(8)).toHaveLength(8);
  });

  it('solo usa caracteres del alfabeto permitido', () => {
    for (let i = 0; i < 500; i++) {
      for (const char of generateRoomCode()) {
        expect(CHARSET).toContain(char);
      }
    }
  });

  it('nunca usa los caracteres excluidos', () => {
    for (let i = 0; i < 500; i++) {
      for (const char of generateRoomCode()) {
        expect(EXCLUIDOS).not.toContain(char);
      }
    }
  });

  it('el alfabeto excluye exactamente 0, 1, I y O', () => {
    // Si esto falla, alguien toco CHARSET: revisa que siga siendo dictable
    const presentes = new Set([...CHARSET]);
    for (const char of EXCLUIDOS) {
      expect(presentes.has(char)).toBe(false);
    }
    expect(CHARSET).toHaveLength(32);
  });

  it('solo genera letras mayusculas y digitos', () => {
    for (let i = 0; i < 200; i++) {
      expect(generateRoomCode()).toMatch(/^[A-Z0-9]+$/);
    }
  });

  it('genera codigos casi siempre distintos', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 500; i++) codes.add(generateRoomCode());

    // Con 32^6 combinaciones posibles, 500 muestras deben ser casi todas distintas
    expect(codes.size).toBeGreaterThan(495);
  });

  it('produce una cadena vacia si se pide longitud 0', () => {
    expect(generateRoomCode(0)).toBe('');
  });

  /**
   * Nota: 8/B, Z/2 y 5/S siguen siendo algo ambiguos al dictarlos, pero se
   * dejaron dentro a proposito. Si algun dia molesta, se quitan de CHARSET
   * y este test avisa si se rompe el tamano del alfabeto.
   */
  it('usa los 32 simbolos del alfabeto', () => {
    const vistos = new Set<string>();
    for (let i = 0; i < 2000; i++) {
      for (const char of generateRoomCode()) vistos.add(char);
    }
    expect(vistos.size).toBe(CHARSET.length);
  });
});