import { PrismaClient } from '@prisma/client';
import { AppError } from '../middleware/errorHandler';
import { config } from '../config';
import path from 'path';
import fs from 'fs';

const prisma = new PrismaClient();

export async function getAllVideos() {
  return prisma.video.findMany({
    where: { status: 'active' },
    orderBy: { createdAt: 'desc' },
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
  duration: number
) {
  const video = await prisma.video.create({
    data: {
      title,
      description,
      duration,
      videoUrl: `/uploads/${file.filename}`,
      thumbnailUrl: null,
    },
  });

  return video;
}

export async function deleteVideo(id: string) {
  const video = await prisma.video.findUnique({ where: { id } });

  if (!video) {
    throw new AppError('Video no encontrado', 404);
  }

  // Delete file from disk
  const filePath = path.resolve(config.uploadDir, path.basename(video.videoUrl));
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  await prisma.video.update({
    where: { id },
    data: { status: 'deleted' },
  });
}