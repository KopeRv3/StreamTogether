/**
 * Semilla de datos de desarrollo.
 *
 * Crea usuarios de prueba y algunos videos de YouTube para poder probar
 * la app sin subir nada a mano.
 *
 *   npm run db:seed
 *
 * Es idempotente: si ya existen, no duplica nada.
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { extractYouTubeId, youtubeThumbnail } from '../utils/youtube';

const prisma = new PrismaClient();

const DEMO_USERS = [
  { username: 'ana', email: 'ana@demo.local', password: 'demo1234' },
  { username: 'beto', email: 'beto@demo.local', password: 'demo1234' },
  { username: 'carla', email: 'carla@demo.local', password: 'demo1234' },
];

const DEMO_VIDEOS = [
  {
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    title: 'Clip de muestra',
    description: 'Video de prueba para verificar la sincronizacion.',
  },
  {
    url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
    title: 'Segundo video de muestra',
    description: 'Sirve para probar el cambio de video en la sala.',
  },
];

async function seedUsers() {
  const passwordHash = await bcrypt.hash('demo1234', 10);
  const created = [];

  for (const user of DEMO_USERS) {
    const existing = await prisma.user.findUnique({ where: { email: user.email } });

    if (existing) {
      console.log(`  - ${user.username}: ya existe`);
      continue;
    }

    const record = await prisma.user.create({
      data: { email: user.email, username: user.username, passwordHash },
      select: { id: true, username: true },
    });

    console.log(`  + ${record.username}`);
    created.push(record);
  }

  return created;
}

async function seedVideos(ownerId: string) {
  for (const video of DEMO_VIDEOS) {
    const youtubeId = extractYouTubeId(video.url);

    if (!youtubeId) {
      console.log(`  ! ${video.title}: URL invalida, se omite`);
      continue;
    }

    const existing = await prisma.video.findFirst({
      where: { youtubeId, status: 'active' },
    });

    if (existing) {
      console.log(`  - ${video.title}: ya existe`);
      continue;
    }

    await prisma.video.create({
      data: {
        title: video.title,
        description: video.description,
        videoUrl: video.url,
        youtubeId,
        thumbnailUrl: youtubeThumbnail(youtubeId),
        source: 'youtube',
        duration: 0,
        ownerId,
      },
    });

    console.log(`  + ${video.title}`);
  }
}

async function main() {
  console.log('\nSembrando datos de desarrollo\n');

  const users = await seedUsers();
  console.log('');

  const owner = users[0] ?? (await prisma.user.findFirst({ select: { id: true } }));

  if (owner) {
    await seedVideos(owner.id);
  } else {
    console.log('No hay usuarios: ejecuta primero el registro desde la app.');
  }

  console.log('\nListo. Credenciales de prueba:');
  for (const user of DEMO_USERS) {
    console.log(`  ${user.username} / ${user.password}`);
  }
  console.log('');
}

main()
  .catch((error) => {
    console.error('Error al sembrar la base de datos:');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
