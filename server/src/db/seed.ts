import { PrismaClient } from '@prisma/client';
import { extractYouTubeId, youtubeThumbnail } from '../utils/youtube';

const prisma = new PrismaClient();

const DEMO_USERS = ['Ana', 'Beto', 'Carla'];

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
  {
    url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
    title: 'Big Buck Bunny',
    description: 'Animacion de dominio publico, util para probar.',
  },
];

async function seedUsers() {
  const created = [];

  for (const username of DEMO_USERS) {
    const existing = await prisma.user.findUnique({ where: { username } });

    if (existing) {
      console.log(`  - ${username}: ya existe`);
      continue;
    }

    await prisma.user.create({ data: { username } });
    console.log(`  + ${username}`);
    created.push(username);
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

    const existing = await prisma.video.findFirst({ where: { youtubeId, status: 'active' } });

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

  const nuevos = await seedUsers();
  console.log('');

  const owner = await prisma.user.findFirst({
    where: { username: { in: DEMO_USERS } },
    select: { id: true },
  });

  if (owner) {
    await seedVideos(owner.id);
  } else if (nuevos.length === 0) {
    console.log('No hay usuarios: escribe un nombre en la app para crear el primero.');
  }

  console.log('\nListo. Estos nombres ya funcionan para entrar:');
  for (const username of DEMO_USERS) {
    console.log(`  ${username}`);
  }
  console.log('\nNo hay contrasena: se entra escribiendo el nombre.\n');
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
