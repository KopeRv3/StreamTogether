/**
 * Sincronizacion de reloj entre cliente y servidor.
 *
 * El problema: el servidor envia `serverTime` (su reloj) y el cliente lo
 * compara contra `Date.now()` (su reloj). Si los relojes estan desviados,
 * la correccion de posicion del video falla de forma constante.
 *
 * La solucion: medir el desfase y restarlo.
 */

/** Un solo outlier no debe arrastrar el promedio. */
const MAX_SAMPLES = 5;

export class ClockSync {
  /** Desfase estimado: servidor - cliente, en milisegundos. */
  private offset = 0;
  private samples: number[] = [];

  /** Registra una medicion. Devuelve el desfase vigente tras procesarla. */
  addSample(serverTime: number, clientTime: number = Date.now()): number {
    const sample = serverTime - clientTime;

    this.samples.push(sample);
    if (this.samples.length > MAX_SAMPLES) this.samples.shift();

    // Mediana: inmune a picos de latencia
    const sorted = [...this.samples].sort((a, b) => a - b);
    this.offset = sorted[Math.floor(sorted.length / 2)];

    return this.offset;
  }

  /** Convierte una hora del cliente a la del servidor. */
  toServerTime(clientTime: number = Date.now()): number {
    return clientTime + this.offset;
  }

  /** El desfase actual, en milisegundos. */
  getOffset(): number {
    return this.offset;
  }

  reset(): void {
    this.offset = 0;
    this.samples = [];
  }

  get sampleCount(): number {
    return this.samples.length;
  }
}

/**
 * Posicion a la que deberia estar el player segun el ultimo estado del
 * anfitrion. La duracion ya transcurrida se suma para compensar el viaje del
 * mensaje por la red.
 */
export function targetPosition(
  payload: { position: number; serverTime: number },
  clock: ClockSync,
): number {
  const nowOnServer = clock.toServerTime();
  const elapsedSeconds = Math.max(0, (nowOnServer - payload.serverTime) / 1000);
  return payload.position + elapsedSeconds;
}

/** Ajuste por debajo del cual no se corrige nada (jitter normal de red). */
export const SILENT_DRIFT_THRESHOLD = 1.25;

/** Ajuste maximo tolerable; por encima conviene avisar al usuario. */
export const HARD_DRIFT_LIMIT = 20;

export type DriftAction = 'none' | 'silent' | 'warn';

/**
 * Decide si hay que corregir la posicion del player.
 * Evita saltos visibles por micro-desfases.
 */
export function evaluateDrift(
  current: number,
  target: number,
): { action: DriftAction; delta: number } {
  const delta = target - current;
  const magnitude = Math.abs(delta);

  if (magnitude <= SILENT_DRIFT_THRESHOLD) {
    return { action: 'none', delta };
  }

  if (magnitude > HARD_DRIFT_LIMIT) {
    return { action: 'warn', delta };
  }

  return { action: 'silent', delta };
}
