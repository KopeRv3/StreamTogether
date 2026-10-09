import { AppError } from '../middleware/errorHandler';

/**
 * Validadores sin dependencias, para no tener que sincronizar reglas entre
 * el cliente y el servidor con dos librerias distintas.
 *
 * El servidor es la unica frontera de confianza: aunque el frontend valide,
 * aqui se vuelve a comprobar porque el cliente puede falsearse.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,30}$/;

export const LIMITS = {
  usernameMin: 3,
  usernameMax: 30,
  passwordMin: 6,
  passwordMax: 200,
  messageMax: 500,
  titleMax: 200,
  descriptionMax: 2000,
  urlMax: 500,
} as const;

/** Lanza AppError(400) si la condicion no se cumple. */
export function assert(condition: unknown, message: string, code?: string): asserts condition {
  if (!condition) {
    throw new AppError(message, 400, code);
  }
}

export function validateEmail(value: unknown): string {
  assert(typeof value === 'string', 'El email es requerido', 'EMAIL_REQUERIDO');

  const email = (value as string).trim().toLowerCase();

  assert(email.length <= 254, 'El email es demasiado largo', 'EMAIL_LARGO');
  assert(EMAIL_RE.test(email), 'El email no tiene un formato valido', 'EMAIL_INVALIDO');

  return email;
}

export function validateUsername(value: unknown): string {
  assert(typeof value === 'string', 'El username es requerido', 'USERNAME_REQUERIDO');

  const username = (value as string).trim();

  assert(
    username.length >= LIMITS.usernameMin && username.length <= LIMITS.usernameMax,
    `El username debe tener entre ${LIMITS.usernameMin} y ${LIMITS.usernameMax} caracteres`,
    'USERNAME_LARGO',
  );
  assert(
    USERNAME_RE.test(username),
    'El username solo admite letras, numeros, punto, guion y guion bajo',
    'USERNAME_INVALIDO',
  );

  return username;
}

export function validatePassword(value: unknown): string {
  assert(typeof value === 'string', 'La contrasena es requerida', 'PASSWORD_REQUERIDO');

  assert(
    value.length >= LIMITS.passwordMin,
    `La contrasena debe tener al menos ${LIMITS.passwordMin} caracteres`,
    'PASSWORD_CORTA',
  );
  assert(value.length <= LIMITS.passwordMax, 'La contrasena es demasiado larga', 'PASSWORD_LARGA');

  return value;
}

export function validateRoomCode(value: unknown): string {
  assert(typeof value === 'string', 'El codigo de sala es requerido', 'CODE_REQUERIDO');

  const code = (value as string).trim().toUpperCase();

  assert(/^[A-Z0-9]{4,10}$/.test(code), 'El codigo de sala no es valido', 'CODE_INVALIDO');

  return code;
}

export function validateMessage(value: unknown): string {
  assert(typeof value === 'string', 'El mensaje es requerido', 'MESSAGE_REQUERIDO');

  const content = (value as string).trim();

  assert(content.length > 0, 'El mensaje no puede estar vacio', 'MESSAGE_VACIO');
  assert(
    content.length <= LIMITS.messageMax,
    `El mensaje no puede superar ${LIMITS.messageMax} caracteres`,
    'MESSAGE_LARGO',
  );

  return content;
}

export function validateTitle(value: unknown, required = false): string | null {
  if (value === undefined || value === null || value === '') {
    assert(!required, 'El titulo es requerido', 'TITULO_REQUERIDO');
    return null;
  }

  assert(typeof value === 'string', 'El titulo debe ser texto', 'TITULO_INVALIDO');

  const title = (value as string).trim();

  assert(title.length <= LIMITS.titleMax, 'El titulo es demasiado largo', 'TITULO_LARGO');

  return title || null;
}

export function validateDescription(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;

  assert(typeof value === 'string', 'La descripcion debe ser texto', 'DESCRIPCION_INVALIDA');

  const description = (value as string).trim();

  assert(
    description.length <= LIMITS.descriptionMax,
    'La descripcion es demasiado larga',
    'DESCRIPCION_LARGA',
  );

  return description || null;
}

/** Duracion en segundos: entero positivo y acotado (7 dias). */
export function validateDuration(value: unknown): number {
  const parsed = typeof value === 'number' ? value : parseInt(String(value ?? ''), 10);

  assert(Number.isFinite(parsed), 'La duracion debe ser un numero', 'DURACION_INVALIDA');
  assert(parsed > 0, 'La duracion debe ser mayor que cero', 'DURACION_CERO');
  assert(parsed <= 604_800, 'La duracion no puede superar 7 dias', 'DURACION_EXCESIVA');

  return Math.floor(parsed);
}
