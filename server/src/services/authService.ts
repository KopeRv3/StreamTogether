import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { generateToken } from '../utils/jwt';
import { AppError } from '../middleware/errorHandler';

const prisma = new PrismaClient();

export async function registerUser(email: string, username: string, password: string) {
  const existingUser = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
  });

  if (existingUser) {
    throw new AppError('El email o nombre de usuario ya está en uso', 400);
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: { email, username, passwordHash },
    select: { id: true, email: true, username: true, avatarUrl: true, createdAt: true },
  });

  const token = generateToken({ userId: user.id, username: user.username });

  return { user, token };
}

export async function loginUser(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    throw new AppError('Credenciales inválidas', 401);
  }

  const validPassword = await bcrypt.compare(password, user.passwordHash);

  if (!validPassword) {
    throw new AppError('Credenciales inválidas', 401);
  }

  const token = generateToken({ userId: user.id, username: user.username });

  return {
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
    },
    token,
  };
}

export async function getUserById(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, username: true, avatarUrl: true, createdAt: true },
  });

  if (!user) {
    throw new AppError('Usuario no encontrado', 404);
  }

  return user;
}
