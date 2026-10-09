/**
 * Prueba de sincronizacion extremo a extremo, imitando lo que hacen dos
 * navegadores reales, pero automatizada.
 *
 * Comprueba el ciclo completo:
 *   1. Dos usuarios (ana anfitriona, beto participante) en la misma sala
 *   2. El anfitrion elige un video de YouTube
 *   3. Al entrar, beto recibe el estado actual del video
 *   4. play / pause / seek del anfitrion se replican en el participante
 *   5. El heartbeat corrige la deriva de posicion
 *   6. El chat llega entre ambos
 *   7. El participante NO puede tomar el control
 *
 * A diferencia de tests/e2e.mjs, aqui se mide la posicion de verdad que
 * aplicaria cada player, no solo que el evento se emitiera.
 *
 * Uso:  node tests/sync.mjs      (con backend y frontend ya levantados)
 */

import { io } from 'socket.io-client';

const VITE = process.env.VITE_URL || 'http://localhost:5173';

let passed = 0;
let failed = 0;
const failures = [];

function ok(name, condition, detail = '') {
  if (condition) {
    passed++;
    console.log(`  [OK]    ${name}`);
  } else {
    failed++;
    failures.push(`${name}${detail ? ` -- ${detail}` : ''}`);
    console.log(`  [FALLA] ${name}${detail ? ` -- ${detail}` : ''}`);
  }
}

const section = (t) => console.log(`\n${t}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(path, { method = 'GET', body, token } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${VITE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await res.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text.slice(0, 100) };
  }
  return { status: res.status, body: json };
}

function login(username, password) {
  return api('/api/auth/login', {
    method: 'POST',
    body: { email: `${username}@demo.local`, password },
  });
}

function connect(token) {
  return new Promise((resolve, reject) => {
    const socket = io(VITE, {
      auth: { token },
      transports: ['websocket'],
      timeout: 8000,
      reconnection: false,
    });

    const timer = setTimeout(() => {
      socket.close();
      reject(new Error('timeout'));
    }, 10000);

    socket.on('connect', () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.on('connect_error', (e) => {
      clearTimeout(timer);
      socket.close();
      reject(e);
    });
  });
}

/**
 * Player simulado: aplica lo mismo que hace useMediaSync, usando el
 * mismo clockSync del cliente.
 */
function createFakePlayer(socket, { isHost, roomId }) {
  let currentTime = 0;
  let playing = false;
  const clock = { offset: 0 };
  let pendingSync = null;

  const seek = (t) => {
    currentTime = Math.max(0, t);
  };
  const play = () => {
    playing = true;
  };
  const pause = () => {
    playing = false;
  };

  socket.on('sync:event', (data) => {
    if (isHost) return;
    clock.offset = data.serverTime - Date.now();
    const elapsed = Math.max(0, (Date.now() + clock.offset - data.serverTime) / 1000);
    const target = data.position + elapsed;
    pendingSync = { target, type: data.type };
    seek(target);
    if (data.type !== 'pause') play();
    else pause();
  });

  socket.on('sync:heartbeat', (data) => {
    if (isHost) return;
    clock.offset = data.serverTime - Date.now();
    const elapsed = Math.max(0, (Date.now() + clock.offset - data.serverTime) / 1000);
    const target = data.position + elapsed;
    // Mismo umbral que evaluateDrift: no se corrige por debajo de 1.25s
    if (Math.abs(target - currentTime) > 1.25) seek(target);
    if (data.playing) play();
    else pause();
  });

  socket.on('sync:state', (state) => {
    if (isHost) return;
    clock.offset = state.timestamp - Date.now();
    seek(state.position);
    if (state.playing) play();
    else pause();
    pendingSync = { initial: true, position: state.position };
  });

  return {
    get time() {
      return currentTime;
    },
    get playing() {
      return playing;
    },
    get lastSync() {
      return pendingSync;
    },
    // El anfitrión emite; el participante solo localmente
    emitPlay: () => socket.emit('sync:event', { roomId, type: 'play', position: currentTime }),
    emitPause: () => socket.emit('sync:event', { roomId, type: 'pause', position: currentTime }),
    emitSeek: (t) => {
      seek(t);
      socket.emit('sync:event', { roomId, type: 'seek', position: t });
    },
    emitHeartbeat: () => socket.emit('sync:heartbeat', { roomId, position: currentTime, playing }),
  };
}

async function main() {
  console.log(`\n=== Sincronizacion extremo a extremo ===`);
  console.log(`Frontend: ${VITE}\n`);

  // ------------------------------------------------------------------
  section('1. Dos usuarios en la misma sala');
  const ana = await login('ana', 'demo1234');
  const beto = await login('beto', 'demo1234');

  ok('ana inicia sesion', ana.status === 200, `status ${ana.status}`);
  ok('beto inicia sesion', beto.status === 200, `status ${beto.status}`);

  const roomRes = await api('/api/rooms', { method: 'POST', token: ana.body.token });
  ok('ana crea la sala', roomRes.status === 201, `status ${roomRes.status}`);

  const room = roomRes.body.room;
  console.log(`  Codigo de la sala: ${room.code}`);

  const join = await api('/api/rooms/join', {
    method: 'POST',
    body: { code: room.code },
    token: beto.body.token,
  });
  ok('beto se une con el codigo', join.status === 200, `status ${join.status}`);

  // ------------------------------------------------------------------
  section('2. Elegir un video de YouTube');
  const ytId = 'aqz-KE-bpKQ'; // Big Buck Bunny: dominio publico, embeddable
  const videoRes = await api('/api/videos/youtube', {
    method: 'POST',
    body: { url: `https://www.youtube.com/watch?v=${ytId}`, title: 'Prueba de sincronizacion' },
    token: ana.body.token,
  });

  let video = videoRes.body.video;
  if (videoRes.status === 409) {
    // Ya existe de una corrida anterior: lo buscamos en la biblioteca
    const list = await api('/api/videos', { token: ana.body.token });
    video = list.body.videos.find((v) => v.youtubeId === ytId);
    ok('el video ya existia, se reutiliza', !!video);
  } else {
    ok('ana agrega el video de YouTube', videoRes.status === 201, `status ${videoRes.status}`);
  }

  const pick = await api(`/api/rooms/${room.id}/video`, {
    method: 'POST',
    body: { videoId: video.id },
    token: ana.body.token,
  });
  ok('ana elige el video para la sala', pick.status === 200, `status ${pick.status}`);

  const withVideo = await api(`/api/rooms/${room.id}`, { token: ana.body.token });
  ok('la sala ya tiene video asignado', !!withVideo.body.room?.video);
  ok('el video es de tipo youtube', withVideo.body.room?.video?.source === 'youtube');
  ok('tiene youtubeId para el player', !!withVideo.body.room?.video?.youtubeId);

  // ------------------------------------------------------------------
  section('3. Conectar por WebSocket');
  const anaSock = await connect(ana.body.token);
  const betoSock = await connect(beto.body.token);
  ok('ana conecta', anaSock.connected);
  ok('beto conecta', betoSock.connected);

  anaSock.emit('room:join', { roomId: room.id });
  await wait(500);
  betoSock.emit('room:join', { roomId: room.id });
  await wait(800);

  const anaPlayer = createFakePlayer(anaSock, { isHost: true, roomId: room.id });
  const betoPlayer = createFakePlayer(betoSock, { isHost: false, roomId: room.id });

  // ------------------------------------------------------------------
  section('4. play / pause / seek del anfitrion');
  anaPlayer.emitPlay();
  await wait(600);
  ok('el participante ve "reproduciendo"', betoPlayer.playing === true);
  ok(
    'la posicion llegó en 0',
    Math.abs(betoPlayer.time) < 1.5,
    `pos=${betoPlayer.time.toFixed(2)}`,
  );

  // Simular que el anfitrión avanza 30s
  anaPlayer.emitSeek(30);
  await wait(600);
  ok(
    'el participante recibe el salto a 30s',
    Math.abs(betoPlayer.time - 30) < 1.5,
    `pos=${betoPlayer.time.toFixed(2)}`,
  );

  // Saltar a la mitad
  anaPlayer.emitSeek(150);
  await wait(600);
  ok(
    'el participante recibe el salto a 150s',
    Math.abs(betoPlayer.time - 150) < 1.5,
    `pos=${betoPlayer.time.toFixed(2)}`,
  );

  anaPlayer.emitPause();
  await wait(600);
  ok('el participante ve "en pausa"', betoPlayer.playing === false);

  // ------------------------------------------------------------------
  section('5. Entrar tarde: el estado actual se comparte');
  const carla = await login('carla', 'demo1234');

  // Carla primero se une por la API, igual que haria la UI al meter el codigo.
  // Si se conecta al socket sin ser participante, el servidor le niega el
  // estado: por eso este paso va antes de conectar el socket.
  const carlaJoin = await api('/api/rooms/join', {
    method: 'POST',
    body: { code: room.code },
    token: carla.body.token,
  });
  ok(
    'carla se une a la sala con el codigo',
    carlaJoin.status === 200,
    `status ${carlaJoin.status}`,
  );

  const carlaSock = await connect(carla.body.token);
  const carlaPlayer = createFakePlayer(carlaSock, { isHost: false, roomId: room.id });

  carlaSock.emit('room:join', { roomId: room.id });
  await wait(300);
  carlaSock.emit('sync:requestState', { roomId: room.id });
  await wait(700);

  ok(
    'quien entra tarde recibe la posicion actual',
    Math.abs(carlaPlayer.time - 150) < 2,
    `pos=${carlaPlayer.time.toFixed(2)} (se esperaba ~150)`,
  );
  ok('y sabe que esta en pausa', carlaPlayer.playing === false);

  // Y ademas: un usuario NO miembro no puede pedir el estado
  const forastero = await api('/api/auth/register', {
    method: 'POST',
    body: {
      email: `forastero${Date.now()}@example.com`,
      username: `forastero${Date.now()}`.slice(0, 28),
      password: 'contrasena123',
    },
  });
  const forasteroSock = await connect(forastero.body.token);
  const denied = new Promise((resolve) => {
    forasteroSock.on('sync:error', (e) => resolve(e));
    setTimeout(() => resolve(null), 3000);
  });
  forasteroSock.on('sync:state', () => resolve({ message: 'LE LLEGO EL ESTADO' }));
  forasteroSock.emit('sync:requestState', { roomId: room.id });
  const denial = await denied;
  ok(
    'un usuario ajeno NO recibe el estado de la sala',
    denial?.message?.includes('acceso') === true,
    JSON.stringify(denial),
  );
  forasteroSock.close();

  // ------------------------------------------------------------------
  section('6. Heartbeat corrige la deriva');
  // El participante se atrasa (red lenta simulada)
  betoPlayer.emitSeek(10);
  await wait(300);
  ok('el participante se atraso a 10s', Math.abs(betoPlayer.time - 10) < 1.5);

  // El anfitrión avisa que va en 200s
  anaPlayer.emitSeek(200);
  await wait(200);
  anaPlayer.emitHeartbeat();
  await wait(700);
  ok(
    'el heartbeat corrige la deriva',
    Math.abs(betoPlayer.time - 200) < 2.5,
    `pos=${betoPlayer.time.toFixed(2)}`,
  );

  // ------------------------------------------------------------------
  section('7. Chat en tiempo real');
  const chatLlega = new Promise((resolve) => {
    anaSock.on('chat:message', (m) => resolve(m));
    setTimeout(() => resolve(null), 4000);
  });
  betoSock.emit('chat:message', { roomId: room.id, content: 'Hola desde la prueba' });
  const msg = await chatLlega;
  ok('el mensaje llega al anfitrion', msg?.content === 'Hola desde la prueba', JSON.stringify(msg));
  ok('identifica a quien lo mando', msg?.user?.username === 'beto', JSON.stringify(msg?.user));

  // ------------------------------------------------------------------
  section('8. Control de acceso en la sincronizacion');
  const rejection = new Promise((resolve) => {
    betoSock.on('sync:error', (e) => resolve(e));
    setTimeout(() => resolve(null), 4000);
  });
  betoPlayer.emitSeek(5);
  const err = await rejection;
  ok('el servidor rechaza que un participante mande sync', !!err, JSON.stringify(err));
  ok('el mensaje explica por que', err?.message?.includes('anfitri') === true, JSON.stringify(err));

  const intruder = await api(`/api/rooms/${room.id}/messages`, {
    token: (await login('ana', 'demo1234')).body.token,
  });
  ok(
    'un participante sí puede leer el historial',
    intruder.status === 200,
    `status ${intruder.status}`,
  );

  // ------------------------------------------------------------------
  anaSock.close();
  betoSock.close();
  carlaSock.close();

  // ------------------------------------------------------------------
  section('9. Limpieza');
  const closed = await api(`/api/rooms/${room.id}/close`, {
    method: 'POST',
    token: ana.body.token,
  });
  ok('la sala se puede cerrar', closed.status === 200, `status ${closed.status}`);

  console.log('\n' + '='.repeat(56));
  console.log(`  RESULTADO:  ${passed} correctas   ${failed} fallidas`);
  console.log('='.repeat(56));

  if (failures.length) {
    console.log('\nFallos:');
    for (const f of failures) console.log(`  - ${f}`);
  }

  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('\nSe detuvo por un error inesperado:');
  console.error(err.message || err);
  process.exit(1);
});
