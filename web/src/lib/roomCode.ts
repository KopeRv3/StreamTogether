/**
 * Utilidades para validar y manipular codigos de sala en el cliente.
 *
 * El alphabeto es el mismo que usa el servidor (generateRoomCode), pero aqui
 * no generamos: solo validamos lo que el usuario escribe.
 */

/** Debe coincidir con CHARSET en server/src/utils/codeGenerator.ts */
export const ROOM_CODE_LENGTH = 6;
export const ROOM_CODE_REGEX = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;

/** Normaliza lo que el usuario escribe: mayusculas y sin espacios. */
export function normalizeRoomCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function isValidRoomCode(code: string): boolean {
  return ROOM_CODE_REGEX.test(code);
}

/**
 * Calcula cuanto falta para completar el codigo, para mostrarlo en la UI.
 * Devuelve el numero de caracteres que faltan.
 */
export function remainingRoomCodeChars(input: string): number {
  return Math.max(0, ROOM_CODE_LENGTH - normalizeRoomCode(input).length);
}
