/**
 * Agrega (o refresca) el campo allowScripts de un package.json.
 *
 * npm 11 ya no ejecuta los scripts de instalacion sin autorizacion
 * explicita: `npm ci` falla con EALLOWSCRIPTS si un paquete los trae.
 * Eso rompia el despliegue en Render y en Railway, porque ahi se ejecuta
 * `npm ci` durante el build.
 *
 * La lista se lee del package-lock, no se escribe a mano, para que no se
 * quede desactualizada al cambiar dependencias.
 *
 *   node scripts/agregar-allow-scripts.js [carpeta]
 */

const fs = require('node:fs');
const path = require('node:path');

const carpeta = process.argv[2] || process.cwd();
const pkgPath = path.join(carpeta, 'package.json');
const lockPath = path.join(carpeta, 'package-lock.json');

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));

const conScripts = new Set(
  Object.entries(lock.packages)
    .filter(([, valor]) => valor.hasInstallScript)
    .map(([ruta]) => ruta.split('node_modules/').pop()),
);

pkg.allowScripts = {};
for (const nombre of conScripts) pkg.allowScripts[nombre] = true;

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

console.log(`${path.basename(carpeta)}: ${Object.keys(pkg.allowScripts).join(', ') || '(ninguno)'}`);