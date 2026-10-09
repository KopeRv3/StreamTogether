/**
 * Prueba end-to-end de StreamTogether.
 *
 * Valida contra un backend real:
 *   - salud del servidor y cabeceras de seguridad
 *   - registro/login, validacion de entrada y rate limiting
 *   - creacion de salas y codigo de invitacion
 *   - alta de videos de YouTube (extraccion de ID desde varios formatos)
 *   - sincronizacion real por WebSocket entre dos usuarios
 *   - control de acceso: un tercero NO puede leer una sala ajena
 *   - propiedad de videos: un usuario NO puede borrar el video de otro
 *
 * Uso:  powershell -File tests/run.ps1
 *       (o directamente `node tests/e2e.mjs` si el backend ya esta arriba)
 */

import { io } from 'socket.io-client';

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3001';
const SOCKET_URL = process.env.TEST_SOCKET_URL || 'http://localhost:3001';

let passed = 0;
let failed = 0;
const failures = [];

function ok(name, condition, detail = '') {
  if (condition) {
    passed++;
    console.log(`  [OK]   ${name}`);
  } else {
    failed++;
    failures.push(`${name}${detail ? ` -- ${detail}` : ''}`);
    console.log(`  [FALLA] ${name}${detail ? ` -- ${detail}` : ''}`);
  }
}

function section(title) {
  console.log(`\n${title}`);
}

async function api(path, { method = 'GET', body, token } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await res.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text.slice(0, 120) };
  }

  return { status: res.status, body: json };
}

const stamp = Date.now();

/**
 * Genera un ID de YouTube valido (11 caracteres de [A-Za-z0-9_-]) distinto en
 * cada corrida, para que la suite sea idempotente aunque la base SQLite
 * conserve los videos de ejecuciones anteriores.
 */
const YT_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
function uniqueYtId(n) {
  let seed = stamp + n * 7919;
  let out = '';
  for (let i = 0; i < 11; i++) {
    out += YT_ALPHABET[seed % YT_ALPHABET.length];
    seed = Math.floor(seed / YT_ALPHABET.length) + 31;
  }
  return out;
}

const user = (n) => ({
  email: `test${n}.${stamp}@example.com`,
  username: `test${n}_${stamp}`.slice(0, 28),
  password: 'contrasena123',
});

async function register(n) {
  const payload = user(n);
  const res = await api('/api/auth/register', { method: 'POST', body: payload });
  if (res.status !== 201) {
    throw new Error(
      `No se pudo registrar el usuario ${n}: HTTP ${res.status} ${JSON.stringify(res.body)}` +
        (res.status === 429
          ? '\n  -> El limitador esta activo. Reinicia el servidor antes de probar (tests/run.ps1 lo hace).'
          : ''),
    );
  }
  return res.body;
}

/** Conecta por WebSocket y espera a que el handshake termine. */
function connectSocket(token) {
  return new Promise((resolve, reject) => {
    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
      timeout: 8000,
      reconnection: false,
    });

    const timer = setTimeout(() => {
      socket.close();
      reject(new Error('timeout conectando por WebSocket'));
    }, 9000);

    socket.on('connect', () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.on('connect_error', (err) => {
      clearTimeout(timer);
      socket.close();
      reject(err);
    });
  });
}

/** Espera un evento concreto con timeout. */
function waitFor(socket, event, ms = 4000) {
  return new Promise((resolve) => {
    const handler = (payload) => {
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(payload);
    };
    const timer = setTimeout(() => {
      socket.off(event, handler);
      resolve(null);
    }, ms);
    socket.on(event, handler);
  });
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log(`\n=== StreamTogether E2E ===`);
  console.log(`Backend: ${BASE}\n`);

  // ------------------------------------------------------------------
  section('1. Salud del servidor');
  const health = await api('/api/health');
  ok('GET /api/health responde 200', health.status === 200, `status ${health.status}`);
  ok('health devuelve status ok', health.body?.status === 'ok', JSON.stringify(health.body));

  const healthRes = await fetch(`${BASE}/api/health`);
  ok(
    'helmet aplica cabeceras de seguridad',
    healthRes.headers.get('x-content-type-options') === 'nosniff',
    `x-content-type-options=${healthRes.headers.get('x-content-type-options')}`,
  );

  // ------------------------------------------------------------------
  section('2. Autenticacion');
  const host = await register(1);
  ok('registro de anfitrion', !!host.token && !!host.user?.id);
  ok('la respuesta no incluye passwordHash', !('passwordHash' in host.user));

  const guest = await register(2);
  ok('registro de participante', !!guest.token);

  const intruder = await register(3);
  ok('registro de usuario externo', !!intruder.token);

  const login = await api('/api/auth/login', {
    method: 'POST',
    body: { email: host.user.email, password: 'contrasena123' },
  });
  ok('login con credenciales correctas', login.status === 200, `status ${login.status}`);

  const badLogin = await api('/api/auth/login', {
    method: 'POST',
    body: { email: host.user.email, password: 'incorrecta' },
  });
  ok(
    'login con contrasena incorrecta da 401',
    badLogin.status === 401,
    `status ${badLogin.status}`,
  );

  const weak = await api('/api/auth/register', {
    method: 'POST',
    body: { email: `weak${stamp}@example.com`, username: `weak${stamp}`, password: '123' },
  });
  ok('registro con contrasena corta es rechazado', weak.status === 400, `status ${weak.status}`);

  const badEmail = await api('/api/auth/register', {
    method: 'POST',
    body: { email: 'no-es-un-email', username: `x${stamp}`, password: '1234567' },
  });
  ok(
    'registro con email invalido es rechazado',
    badEmail.status === 400,
    `status ${badEmail.status}`,
  );

  const badUser = await api('/api/auth/register', {
    method: 'POST',
    body: { email: `sp${stamp}@example.com`, username: 'a b', password: '1234567' },
  });
  ok(
    'registro con username invalido es rechazado',
    badUser.status === 400,
    `status ${badUser.status}`,
  );

  const noAuth = await api('/api/rooms', { method: 'POST' });
  ok('crear sala sin token da 401', noAuth.status === 401, `status ${noAuth.status}`);

  const badToken = await api('/api/rooms', { method: 'POST', token: 'no-es-un-jwt' });
  ok('crear sala con token falso da 401', badToken.status === 401, `status ${badToken.status}`);

  // ------------------------------------------------------------------
  section('3. Salas');
  const created = await api('/api/rooms', { method: 'POST', token: host.token });
  ok(
    'crear sala',
    created.status === 201,
    `status ${created.status} ${JSON.stringify(created.body)}`,
  );

  const room = created.body.room;
  ok('la sala tiene codigo de 6 caracteres', /^[A-Z0-9]{6}$/.test(room?.code ?? ''), room?.code);
  ok('el anfitrion queda como participante', room?.participants?.length === 1);
  ok('el anfitrion tiene rol "host"', room?.participants?.[0]?.role === 'host');

  const joined = await api('/api/rooms/join', {
    method: 'POST',
    body: { code: room.code },
    token: guest.token,
  });
  ok('unirse con el codigo correcto', joined.status === 200, `status ${joined.status}`);
  ok('la sala ahora tiene 2 participantes', joined.body?.room?.participants?.length === 2);

  const rejoin = await api('/api/rooms/join', {
    method: 'POST',
    body: { code: room.code },
    token: guest.token,
  });
  ok('unirse dos veces no duplica al participante', rejoin.body?.alreadyJoined === true);

  const badCode = await api('/api/rooms/join', {
    method: 'POST',
    body: { code: 'ZZZZZZ' },
    token: guest.token,
  });
  ok('unirse con codigo inexistente da 404', badCode.status === 404, `status ${badCode.status}`);

  const noCode = await api('/api/rooms/join', { method: 'POST', body: {}, token: guest.token });
  ok('unirse sin codigo da 400', noCode.status === 400, `status ${noCode.status}`);

  // ------------------------------------------------------------------
  section('4. Videos de YouTube');
  // Cada caso usa un ID distinto: con el mismo ID el servidor responderia
  // 409 por duplicado y estariamos probando lo equivocado.
  const ytCases = [
    [`https://www.youtube.com/watch?v=${uniqueYtId(1)}`, true, 'watch?v='],
    [`https://youtu.be/${uniqueYtId(2)}`, true, 'youtu.be'],
    [`https://www.youtube.com/embed/${uniqueYtId(3)}`, true, 'embed'],
    [`https://www.youtube.com/shorts/${uniqueYtId(4)}`, true, 'shorts'],
    [`https://m.youtube.com/watch?v=${uniqueYtId(5)}&t=42s`, true, 'watch?v= con timestamp'],
    [`https://www.youtube.com/live/${uniqueYtId(6)}`, true, 'live'],
    [uniqueYtId(7), true, 'ID suelto'],
    ['https://www.youtube.com/playlist?list=PL123', false, 'playlist (no es un video)'],
    ['https://vimeo.com/12345', false, 'URL que no es de YouTube'],
    ['https://www.youtube.com/watch?v=corto', false, 'ID demasiado corto'],
    [`https://evil.com/watch?v=${uniqueYtId(8)}`, false, 'host falso'],
    ['no-es-una-url', false, 'basura'],
  ];

  for (const [url, shouldPass, label] of ytCases) {
    const res = await api('/api/videos/youtube', {
      method: 'POST',
      body: { url, title: `Test ${label}` },
      token: host.token,
    });
    const passedCase = shouldPass ? res.status === 201 : res.status === 400;
    ok(
      `URL de YouTube "${label}" ${shouldPass ? 'aceptada' : 'rechazada'}`,
      passedCase,
      `status ${res.status}`,
    );
  }

  const mainYtId = uniqueYtId(50);
  const ytVideo = await api('/api/videos/youtube', {
    method: 'POST',
    body: { url: `https://www.youtube.com/watch?v=${mainYtId}` },
    token: host.token,
  });
  ok('alta de video de YouTube', ytVideo.status === 201, `status ${ytVideo.status}`);
  ok(
    'guarda el youtubeId extraido',
    ytVideo.body?.video?.youtubeId === mainYtId,
    String(ytVideo.body?.video?.youtubeId),
  );
  ok('marca la fuente como "youtube"', ytVideo.body?.video?.source === 'youtube');
  ok('asigna el ownerId', ytVideo.body?.video?.ownerId === host.user.id);
  ok('genera thumbnail de YouTube', /i\.ytimg\.com/.test(ytVideo.body?.video?.thumbnailUrl ?? ''));

  const dup = await api('/api/videos/youtube', {
    method: 'POST',
    body: { url: `https://youtu.be/${mainYtId}` },
    token: host.token,
  });
  ok('rechaza YouTube duplicado (409)', dup.status === 409, `status ${dup.status}`);

  const noUrl = await api('/api/videos/youtube', { method: 'POST', body: {}, token: host.token });
  ok('rechaza alta sin URL', noUrl.status === 400, `status ${noUrl.status}`);

  const list = await api('/api/videos', { token: host.token });
  ok('listado de videos', list.status === 200 && Array.isArray(list.body?.videos));

  // ------------------------------------------------------------------
  section('5. Control de acceso (IDOR)');
  const setVideo = await api(`/api/rooms/${room.id}/video`, {
    method: 'POST',
    body: { videoId: ytVideo.body.video.id },
    token: host.token,
  });
  ok('el anfitrion puede elegir el video', setVideo.status === 200, `status ${setVideo.status}`);

  const guestPick = await api(`/api/rooms/${room.id}/video`, {
    method: 'POST',
    body: { videoId: ytVideo.body.video.id },
    token: guest.token,
  });
  ok(
    'un NO anfitrion NO puede cambiar el video',
    guestPick.status === 403,
    `status ${guestPick.status}`,
  );

  const guestClose = await api(`/api/rooms/${room.id}/close`, {
    method: 'POST',
    token: guest.token,
  });
  ok(
    'un NO anfitrion NO puede cerrar la sala',
    guestClose.status === 403,
    `status ${guestClose.status}`,
  );

  // Este era el fallo de seguridad original: solo exigia "estar logueado"
  const intruderRead = await api(`/api/rooms/${room.id}`, { token: intruder.token });
  ok(
    'un usuario ajeno NO puede leer la sala (IDOR corregido)',
    intruderRead.status === 403,
    `status ${intruderRead.status} (antes devolvia 200 con datos ajenos)`,
  );

  const intruderMsgs = await api(`/api/rooms/${room.id}/messages`, { token: intruder.token });
  ok(
    'un usuario ajeno NO puede leer el chat (IDOR corregido)',
    intruderMsgs.status === 403,
    `status ${intruderMsgs.status}`,
  );

  const memberRead = await api(`/api/rooms/${room.id}`, { token: guest.token });
  ok(
    'un participante SI puede leer la sala',
    memberRead.status === 200,
    `status ${memberRead.status}`,
  );

  // ------------------------------------------------------------------
  section('6. Propiedad de videos');
  const foreignDelete = await api(`/api/videos/${ytVideo.body.video.id}`, {
    method: 'DELETE',
    token: intruder.token,
  });
  ok(
    'un usuario ajeno NO puede borrar el video',
    foreignDelete.status === 403,
    `status ${foreignDelete.status}`,
  );

  const stillThere = await api('/api/videos', { token: host.token });
  ok(
    'el video sigue existiendo tras el intento de borrado',
    stillThere.body?.videos?.some((v) => v.id === ytVideo.body.video.id),
  );

  const ownDelete = await api(`/api/videos/${ytVideo.body.video.id}`, {
    method: 'DELETE',
    token: host.token,
  });
  ok('el dueno SI puede borrar su video', ownDelete.status === 200, `status ${ownDelete.status}`);

  // ------------------------------------------------------------------
  section('7. Tiempo real (WebSocket)');
  let hostSocket = null;
  let guestSocket = null;

  try {
    hostSocket = await connectSocket(host.token);
    ok('el anfitrion conecta por WebSocket', hostSocket.connected);
  } catch (err) {
    ok('el anfitrion conecta por WebSocket', false, err.message);
  }

  try {
    guestSocket = await connectSocket(guest.token);
    ok('el participante conecta por WebSocket', guestSocket.connected);
  } catch (err) {
    ok('el participante conecta por WebSocket', false, err.message);
  }

  try {
    await connectSocket('token-invalido-fake');
    ok('un token invalido NO puede conectarse', false, 'la conexion fue aceptada');
  } catch {
    ok('un token invalido NO puede conectarse', true);
  }

  if (hostSocket?.connected && guestSocket?.connected) {
    hostSocket.emit('room:join', { roomId: room.id });
    await wait(400);
    guestSocket.emit('room:join', { roomId: room.id });
    await wait(600);

    const syncPromise = waitFor(guestSocket, 'sync:event', 4000);
    hostSocket.emit('sync:event', { roomId: room.id, type: 'play', position: 42 });
    const syncEvent = await syncPromise;
    ok(
      'el participante recibe el evento sync del anfitrion',
      !!syncEvent,
      JSON.stringify(syncEvent),
    );
    ok(
      'el evento trae la posicion correcta',
      syncEvent?.position === 42,
      `position=${syncEvent?.position}`,
    );
    ok('el evento indica "play"', syncEvent?.type === 'play');
    ok('el evento incluye serverTime', typeof syncEvent?.serverTime === 'number');

    // Antes el servidor confiaba en el cliente ("we trust the client")
    const guestRejection = waitFor(guestSocket, 'sync:error', 4000);
    guestSocket.emit('sync:event', { roomId: room.id, type: 'pause', position: 10 });
    const rejection = await guestRejection;
    ok(
      'el servidor RECHAZA que un participante mande sync',
      !!rejection,
      JSON.stringify(rejection),
    );

    const hbPromise = waitFor(guestSocket, 'sync:heartbeat', 4000);
    hostSocket.emit('sync:heartbeat', { roomId: room.id, position: 77, playing: true });
    const heartbeat = await hbPromise;
    ok(
      'el participante recibe el heartbeat',
      heartbeat?.position === 77,
      JSON.stringify(heartbeat),
    );

    const statePromise = waitFor(guestSocket, 'sync:state', 4000);
    guestSocket.emit('sync:requestState', { roomId: room.id });
    const state = await statePromise;
    ok('el participante puede pedir el estado actual', !!state, JSON.stringify(state));
    ok(
      'el estado refleja la ultima posicion del anfitrion',
      state?.position === 77,
      `position=${state?.position}`,
    );

    const chatPromise = waitFor(hostSocket, 'chat:message', 4000);
    guestSocket.emit('chat:message', { roomId: room.id, content: 'Hola a todos' });
    const chat = await chatPromise;
    ok(
      'el chat llega al otro participante',
      chat?.content === 'Hola a todos',
      JSON.stringify(chat),
    );
    ok('el chat incluye el usuario emisor', !!chat?.user?.username, JSON.stringify(chat?.user));

    const emptyChat = waitFor(guestSocket, 'chat:error', 2000);
    guestSocket.emit('chat:message', { roomId: room.id, content: '   ' });
    ok('un mensaje vacio se ignora sin error', (await emptyChat) === null);

    const history = await api(`/api/rooms/${room.id}/messages`, { token: host.token });
    ok('el chat queda guardado en la base de datos', history.body?.messages?.length >= 1);

    let intruderSocket = null;
    try {
      intruderSocket = await connectSocket(intruder.token);
      const denied = waitFor(intruderSocket, 'chat:error', 3000);
      intruderSocket.emit('chat:message', { roomId: room.id, content: 'me cole' });
      ok('un usuario ajeno NO puede chatear en la sala', !!(await denied));
      intruderSocket.close();
    } catch {
      ok('un usuario ajeno NO puede chatear en la sala', false, 'no se pudo conectar');
    }
  }

  hostSocket?.close();
  guestSocket?.close();

  // ------------------------------------------------------------------
  section('8. Rate limiting');
  const attempts = [];
  for (let i = 0; i < 16; i++) {
    const r = await api('/api/auth/login', {
      method: 'POST',
      body: { email: 'nadie@example.com', password: 'incorrecta' },
    });
    attempts.push(r.status);
  }
  ok(
    'el login se bloquea tras muchos intentos (anti fuerza bruta)',
    attempts.includes(429),
    `estados: ${attempts.join(',')}`,
  );

  // El limite de videos es 20 por hora; saturamos hasta que aparezca el 429
  let sawVideoLimit = false;
  for (let i = 0; i < 25; i++) {
    const r = await api('/api/videos/youtube', {
      method: 'POST',
      body: { url: `https://youtu.be/${uniqueYtId(100 + i)}` },
      token: host.token,
    });
    if (r.status === 429) {
      sawVideoLimit = true;
      break;
    }
  }
  ok('el limite tambien aplica al alta de videos', sawVideoLimit);

  // ------------------------------------------------------------------
  section('9. Rutas inexistentes');
  const notFound = await api('/api/no-existe', { token: host.token });
  ok('ruta de API inexistente da 404 JSON', notFound.status === 404 && !!notFound.body?.error);

  // ------------------------------------------------------------------
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
  console.error('\nLa prueba se detuvo por un error inesperado:');
  console.error(err.message || err);
  process.exit(1);
});
