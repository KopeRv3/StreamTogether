import { PrismaClient } from '@prisma/client';
import { AppError } from '../middleware/errorHandler';
import { config } from '../config';
import { extractYouTubeId, youtubeThumbnail } from '../utils/youtube';
import path from 'path';
import fs from 'fs';

const prisma = new PrismaClient();

export async function getAllVideos() {
  return prisma.video.findMany({
    where: { status: 'active' },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      description: true,
      duration: true,
      thumbnailUrl: true,
      videoUrl: true,
      youtubeId: true,
      source: true,
      ownerId: true,
      status: true,
      createdAt: true,
    },
  });
}

export async function getVideoById(id: string) {
  const video = await prisma.video.findUnique({ where: { id } });

  if (!video) {
    throw new AppError('Video no encontrado', 404);
  }

  return video;
}

export async function createVideo(
  file: Express.Multer.File,
  title: string,
  description: string | null,
  duration: number,
  ownerId: string,
) {
  return prisma.video.create({
    data: {
      title,
      description,
      duration,
      videoUrl: `/uploads/${file.filename}`,
      youtubeId: null,
      source: 'upload',
      thumbnailUrl: null,
      ownerId,
    },
  });
}

/**
 * Registra un video de YouTube a partir de su URL.
 * No se sube ningún archivo: el player usa la IFrame API de YouTube.
 */
export async function createYouTubeVideo(
  url: string,
  title: string | null,
  description: string | null,
  ownerId: string,
  durationHint: number = 0,
) {
  const youtubeId = extractYouTubeId(url);

  if (!youtubeId) {
    throw new AppError(
      'URL de YouTube no válida. Usa un enlace de watch, youtu.be, embed o shorts.',
      400,
    );
  }

  const duplicate = await prisma.video.findFirst({
    where: { youtubeId, status: 'active' },
  });

  if (duplicate) {
    throw new AppError('Ese video de YouTube ya está en la biblioteca', 409);
  }

  const cleanTitle = title?.trim() || `Video de YouTube (${youtubeId})`;

  return prisma.video.create({
    data: {
      title: cleanTitle.slice(0, 200),
      description: description?.trim() || null,
      // YouTube no expone la duración sin llamar a su API; 0 = "desconocida"
      duration: Number.isFinite(durationHint) && durationHint > 0 ? Math.floor(durationHint) : 0,
      videoUrl: url,
      youtubeId,
      source: 'youtube',
      thumbnailUrl: youtubeThumbnail(youtubeId),
      ownerId,
    },
  });
}

/**
 * Elimina un video. Solo el dueño puede borrarlo.
 * Para videos de YouTube únicamente marca el estado; nunca toca nada externo.
 */
export async function deleteVideo(id: string, userId: string) {
  const video = await prisma.video.findUnique({ where: { id } });

  if (!video || video.status !== 'active') {
    throw new AppError('Video no encontrado', 404);
  }

  // Un admin puede borrar cualquier cosa; el resto solo lo suyo
  if (video.ownerId && video.ownerId !== userId) {
    throw new AppError('Solo puedes eliminar los videos que tú subiste', 403);
  }

  // Borra el archivo físico solo si es un upload propio
  if (video.source === 'upload' && video.ownerId === userId) {
    const filePath = path.resolve(config.uploadDir, path.basename(video.videoUrl));
    // path.basename evita path traversal (../../etc/passwd)
    if (fs.existsSync(filePath) && path.dirname(filePath) === path.resolve(config.uploadDir)) {
      fs.unlinkSync(filePath);
    }
  }

  await prisma.video.update({
    where: { id },
    data: { status: 'deleted' },
  });
}
