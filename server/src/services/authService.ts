import { PrismaClient } from '@prisma/client';
import { generateToken } from '../utils/jwt';
import { AppError } from '../middleware/errorHandler';

const prisma = new PrismaClient();

/**
 * Entra a la app indicando únicamente un nombre de usuario.
 *
 * No hay correo ni contraseña a propósito: el objetivo es que cualquiera
 * entre a ver una sala en segundos, sin formularios ni verificaciones.
 *
 * Si el nombre ya existe se reutiliza esa identidad, de modo que quien
 * vuelva a entrar conserva su historial de salas. Como no hay contraseña,
 * eso significa también que cualquiera puede entrar con el nombre de otro:
 * es el precio de no tener registro.
 */
export async function enterAsGuest(rawUsername: string) {
  const username = normalizeUsername(rawUsername);

  const existing = await prisma.user.findUnique({ where: { username } });

  const user =
    existing ??
    (await prisma.user.create({
      data: { username },
      select: { id: true, username: true, avatarUrl: true, createdAt: true },
    }));

  // El token identifica la sesión mientras la pestaña esté abierta.
  const token = generateToken({ userId: user.id, username: user.username });

  return { user, token };
}

/**
 * Quita espacios y recorta a lo razonable. Se conservan mayúsculas y
 * minúsculas porque el nombre es lo que se ve dentro de la sala.
 */
export function normalizeUsername(value: string): string {
  return value.trim().replace(/\s+/g, ' ').slice(0, 30);
}

export async function getUserById(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, avatarUrl: true, createdAt: true },
  });

  if (!user) {
    throw new AppError('Usuario no encontrado', 404);
  }

  return user;
}
