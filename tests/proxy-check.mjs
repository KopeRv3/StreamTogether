/**
 * Verifica que el proxy de Vite enruta correctamente el trafico de
 * Socket.IO (handshake + upgrade a WebSocket) al backend.
 *
 * Esto es exactamente lo que fallaba antes: /socket.io no estaba en el proxy,
 * el handshake recibia el index.html y toda la parte de tiempo real moria.
 *
 * Uso:  node tests/proxy-check.mjs      (con server y web ya levantados)
 */

import { io } from 'socket.io-client';

const VITE = process.env.VITE_URL || 'http://localhost:5173';
const BACKEND = process.env.BACKEND_URL || 'http://localhost:3001';

let failed = 0;

function ok(name, condition, detail = '') {
  if (condition) console.log(`  [OK]    ${name}`);
  else {
    failed++;
    console.log(`  [FALLA] ${name}${detail ? ` -- ${detail}` : ''}`);
  }
}

async function main() {
  console.log(`\n=== Verificacion del proxy de Vite ===`);
  console.log(`Vite:    ${VITE}`);
  console.log(`Backend: ${BACKEND}\n`);

  // ------------------------------------------------------------------
  console.log('1. Handshake crudo por HTTP');
  for (const [label, url] of [
    ['directo al backend', `${BACKEND}/socket.io/?EIO=4&transport=polling`],
    ['a traves del proxy', `${VITE}/socket.io/?EIO=4&transport=polling`],
  ]) {
    try {
      const res = await fetch(url);
      const text = await res.text();
      const isHandshake = text.startsWith('0{') && text.includes('sid');
      ok(
        `Socket.IO handshake ${label}`,
        isHandshake,
        `content-type=${res.headers.get('content-type')} body=${text.slice(0, 60)}`,
      );
    } catch (err) {
      ok(`Socket.IO handshake ${label}`, false, err.message);
    }
  }

  // ------------------------------------------------------------------
  console.log('\n2. Conexion real de socket.io-client a traves del proxy');
  console.log('   (esto exige el upgrade a WebSocket: valida ws:true)');

  // Necesitamos un token valido. El endpoint de registro tiene un limitador
  // estricto (10 por 15 min), asi que primero probamos con un login: si hay
  // un usuario sembrado, el login tiene su propio cupo y suele estar libre.
  let token = null;

  try {
    const res = await fetch(`${VITE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'ana@demo.local', password: 'demo1234' }),
    });
    const data = await res.json();
    token = data.token ?? null;
    ok('se obtuvo un token (usuario de la semilla)', !!token, JSON.stringify(data).slice(0, 90));
  } catch (err) {
    ok('se obtuvo un token (usuario de la semilla)', false, err.message);
  }

  // Si el login no funciono, se intenta registrar uno temporal
  if (!token) {
    try {
      const stamp = Date.now();
      const res = await fetch(`${VITE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `proxy${stamp}@example.com`,
          username: `proxy${stamp}`.slice(0, 28),
          password: 'contrasena123',
        }),
      });
      const data = await res.json();
      token = data.token ?? null;
      ok(
        'se registro un usuario temporal via el proxy',
        !!token,
        JSON.stringify(data).slice(0, 90),
      );
    } catch (err) {
      ok('se registro un usuario temporal via el proxy', false, err.message);
    }
  }

  if (!token) {
    console.log('\n  No se pudo obtener un token (limitador activo).');
    console.log('  Reinicia el backend con un estado limpio antes de esta prueba.');
    console.log('  Para eso:  npm run test:all\n');
    console.log('='.repeat(56));
    console.log('  PROXY: sin token, no se puede probar el WebSocket');
    console.log('='.repeat(56));
    process.exit(1);
  }

  if (token) {
    for (const [label, url] of [
      ['directo al backend', BACKEND],
      ['a traves del proxy de Vite', VITE],
    ]) {
      const connected = await new Promise((resolve) => {
        const socket = io(url, {
          auth: { token },
          transports: ['websocket'],
          timeout: 8000,
          reconnection: false,
        });

        const timer = setTimeout(() => {
          socket.close();
          resolve({ ok: false, reason: 'timeout' });
        }, 10000);

        socket.on('connect', () => {
          clearTimeout(timer);
          resolve({ ok: true, transport: socket.io.engine.transport.name, id: socket.id });
        });
        socket.on('connect_error', (err) => {
          clearTimeout(timer);
          socket.close();
          resolve({ ok: false, reason: err.message });
        });
      });

      ok(`conexion WebSocket ${label}`, connected.ok, connected.ok ? '' : connected.reason);

      if (connected.ok) {
        ok(
          `  usa transporte websocket (no polling)`,
          connected.transport === 'websocket',
          connected.transport,
        );
      }
    }
  }

  console.log('\n' + '='.repeat(56));
  console.log(failed === 0 ? '  PROXY OK' : `  ${failed} fallo(s)`);
  console.log('='.repeat(56));
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
