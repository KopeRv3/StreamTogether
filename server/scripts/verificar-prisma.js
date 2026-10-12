/**
 * Comprueba, durante el build del contenedor, que Prisma puede cargar su
 * motor y el cliente.
 *
 * Es una red de seguridad: si el motor falta o no corresponde a la
 * plataforma, el build falla aqui con un mensaje claro, en vez de dejar que
 * el servidor reviente al arrancar en produccion.
 *
 * Lo ejecutaba 'prisma generate' y el fallo solo aparecia en runtime con
 * un error dificil de atribuir.
 *
 *   node scripts/verificar-prisma.js
 */

const { PrismaClient } = require('@prisma/client');

const cliente = new PrismaClient();

// No hace falta una base de datos valida: solo se verifica que el motor
// binario se pueda cargar. Si el engine falta, Prisma lanza aqui.
cliente
  .$disconnect()
  .then(() => {
    console.log('[build] Prisma Client carga correctamente');
  })
  .catch((error) => {
    console.error('[build] Prisma Client no se pudo cargar:');
    console.error(`         ${error.message}`);
    process.exit(1);
  });