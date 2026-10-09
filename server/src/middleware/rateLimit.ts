import { Request, Response, NextFunction } from 'express';

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Rate limiter en memoria, sin dependencias externas.
 * Suficiente para una sola instancia; si en el futuro hay varias,
 * hay que moverlo a Redis.
 */
export function rateLimit(options: { windowMs: number; max: number; message?: string }) {
  const buckets = new Map<string, Bucket>();
  const {
    windowMs,
    max,
    message = 'Demasiadas peticiones. Intenta de nuevo en un momento.',
  } = options;

  // Limpieza periódica para no crecer sin límite
  const sweeper = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }, windowMs);

  // No mantener vivo el proceso solo por este timer
  sweeper.unref?.();

  return function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
    // Si ya hay sesión autenticada, limitamos por usuario; si no, por IP
    const key = (req as Request & { userId?: string }).userId ?? req.ip ?? 'anonymous';
    const now = Date.now();

    let bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }

    bucket.count += 1;

    const remaining = Math.max(0, max - bucket.count);
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > max) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({ error: message });
    }

    next();
  };
}

/** Límite estricto para endpoints de autenticación (anti fuerza bruta). */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Demasiados intentos. Espera unos minutos antes de volver a intentar.',
});

/** Límite general para el resto de la API. */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
});

/** Límite para crear salas y unirse, evita spam de salas. */
export const roomLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
});
