/**
 * Build del proyecto segun el entorno.
 *
 * En local compila el backend y el frontend, que es lo esperable durante el
 * desarrollo.
 *
 * En Railway solo compila el backend. Motivo: el servicio de produccion es
 * solo la API, y desplegarlo desde la raiz obligaba a Nixpacks a compilar
 * tambien el frontend, donde no hay dependencias de servidor instaladas:
 *
 *   [ERRO] sh: 1: prisma: not found
 *
 * Ademas el frontend se despliega aparte, en Vercel.
 *
 * Se detecta Railway por las variables que Railway inyecta en el build.
 */

const { spawnSync } = require('node:child_process');

const esRailway = Boolean(process.env.RAILWAY_ENVIRONMENT);

function ejecutar(comando, argumentos) {
  const resultado = spawnSync(comando, argumentos, {
    stdio: 'inherit',
    // En Windows el ejecutable es npm.cmd, no npm. Con shell:true el comando
    // se resuelve por el PATH del sistema en ambos sistemas operativos.
    shell: true,
  });

  if (resultado.status !== 0) {
    console.error(`[build] fallo: ${comando} ${argumentos.join(' ')}`);
    process.exit(resultado.status ?? 1);
  }
}

if (esRailway) {
  console.log('[build] Railway: compilando solo el backend');

  // Las dependencias del servidor no se instalan solas porque viven en
  // server/ y Nixpacks solo ejecuta npm ci en la raiz.
  ejecutar('npm', ['--prefix', 'server', 'ci']);
  ejecutar('npm', ['--prefix', 'server', 'run', 'build']);
} else {
  console.log('[build] local: compilando backend y frontend');
  ejecutar('npm', ['--prefix', 'server', 'run', 'build']);
  ejecutar('npm', ['--prefix', 'web', 'run', 'build']);
}