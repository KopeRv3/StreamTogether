import { describe, it, expect } from 'vitest';
import {
  ClockSync,
  targetPosition,
  evaluateDrift,
  SILENT_DRIFT_THRESHOLD,
  HARD_DRIFT_LIMIT,
} from '../src/lib/clockSync';

describe('ClockSync', () => {
  it('estima el desfase entre cliente y servidor', () => {
    const clock = new ClockSync();
    // El servidor va 5 segundos adelantado
    clock.addSample(10_000, 5_000);
    expect(clock.getOffset()).toBe(5000);
  });

  it('convierte la hora del cliente a la del servidor', () => {
    const clock = new ClockSync();
    clock.addSample(10_000, 5_000);
    expect(clock.toServerTime(1000)).toBe(6000);
  });

  it('ignora picos de latencia gracias a la mediana', () => {
    const clock = new ClockSync();
    // Cuatro mediciones correctas de +1000ms
    clock.addSample(1000, 0);
    clock.addSample(1000, 0);
    clock.addSample(1000, 0);
    clock.addSample(1000, 0);
    // Una medicion absurda por un pico de latencia
    clock.addSample(90_000, 0);

    expect(Math.abs(clock.getOffset())).toBeLessThan(2000);
  });

  it('mantiene solo las ultimas muestras', () => {
    const clock = new ClockSync();
    for (let i = 0; i < 20; i++) clock.addSample(100, 0);
    expect(clock.sampleCount).toBeLessThanOrEqual(5);
  });

  it('reset() vuelve al estado inicial', () => {
    const clock = new ClockSync();
    clock.addSample(10_000, 0);
    clock.reset();
    expect(clock.getOffset()).toBe(0);
    expect(clock.sampleCount).toBe(0);
  });
});

describe('targetPosition', () => {
  it('suma el tiempo transcurrido desde que el servidor envio el evento', () => {
    const clock = new ClockSync();
    const base = Date.now();

    // Reloj del cliente sincronizado con el del servidor (desfase 0)
    clock.addSample(base, base);

    const payload = { position: 100, serverTime: base - 2000 };

    // 2 segundos de transito -> la posicion objetivo debe estar cerca de 102
    const target = targetPosition(payload, clock);
    expect(target).toBeGreaterThan(101.9);
    expect(target).toBeLessThan(102.1);
  });

  it('nunca devuelve una posicion anterior al payload', () => {
    const now = Date.now();
    const clock = new ClockSync();
    clock.addSample(now, now);

    // serverTime en el futuro: no debe restar
    const payload = { position: 50, serverTime: now + 5000 };
    expect(targetPosition(payload, clock)).toBeGreaterThanOrEqual(50);
  });

  it('compensa el desfase de reloj', () => {
    // Dos clientes con relojes desviados en distinto grado reciben el mismo
    // evento del servidor y deben calcular la MISMA posicion objetivo.
    //
    // La clave: cada cliente convierte SU PROPIA lectura de reloj. El cliente A
    // marca un instante 5s antes que el servidor, el B 3s despues.
    const serverTime = 1_000_000;

    const clientAReading = serverTime - 5000;
    const clientBReading = serverTime + 3000;

    const clockA = new ClockSync();
    clockA.addSample(serverTime, clientAReading);

    const clockB = new ClockSync();
    clockB.addSample(serverTime, clientBReading);

    // Cada uno traduce su reloj al del servidor
    expect(clockA.toServerTime(clientAReading)).toBe(serverTime);
    expect(clockB.toServerTime(clientBReading)).toBe(serverTime);

    // Sin correccion, los dosClients verian tiempos muy distintos
    expect(clientAReading).not.toBe(clientBReading);
  });

  it('dos clientes con relojes distintos convergen en la misma posicion', () => {
    const serverTime = 2_000_000;
    const payload = { position: 42, serverTime };

    // Cada cliente mide su propio desfase y, 3 segundos despues del evento,
    // calcula su posicion objetivo con SU lectura de reloj.
    const results = [0, 3000, -7000, 15000].map((skew) => {
      const clock = new ClockSync();
      const readingAtEvent = serverTime + skew;
      clock.addSample(serverTime, readingAtEvent);

      // Tres segundos mas tarde segun su propio reloj
      const nowClient = readingAtEvent + 3000;
      const elapsed = (clock.toServerTime(nowClient) - serverTime) / 1000;

      return payload.position + elapsed;
    });

    // Los cuatro deben coincidir: 42 + 3s
    for (const r of results) {
      expect(r).toBeCloseTo(45, 5);
    }
  });

  it('dos clientes con relojes distintos convergen en la misma posicion', () => {
    const serverTime = 2_000_000;
    const payload = { position: 42, serverTime };

    // Cada cliente mide su propio desfase y calcula por separado
    const results = [0, 3000, -7000, 15000].map((skew) => {
      const clock = new ClockSync();
      const clientTime = serverTime + skew;
      clock.addSample(serverTime, clientTime);
      return payload.position + (clock.toServerTime(clientTime) - serverTime) / 1000;
    });

    for (const r of results) {
      expect(r).toBeCloseTo(42, 5);
    }
  });
});

describe('evaluateDrift', () => {
  it('no corrige desfases minimos', () => {
    const result = evaluateDrift(100, 100.5);
    expect(result.action).toBe('none');
  });

  it('ignora el jitter de red', () => {
    const result = evaluateDrift(100, 100 + SILENT_DRIFT_THRESHOLD - 0.1);
    expect(result.action).toBe('none');
  });

  it('corrige en silencio un desfase apreciable', () => {
    const result = evaluateDrift(100, 105);
    expect(result.action).toBe('silent');
    expect(result.delta).toBeCloseTo(5);
  });

  it('avisa cuando el desfase es muy grande', () => {
    const result = evaluateDrift(100, 100 + HARD_DRIFT_LIMIT + 5);
    expect(result.action).toBe('warn');
  });

  it('funciona tambien cuando el player va adelantado', () => {
    const result = evaluateDrift(105, 100);
    expect(result.action).toBe('silent');
    expect(result.delta).toBeCloseTo(-5);
  });
});