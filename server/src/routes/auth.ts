import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import { enterAsGuest, getUserById } from '../services/authService';
import { validateUsername } from '../utils/validation';
import { asyncHandler } from '../utils/asyncHandler';

export const authRouter = Router();

/**
 * Entrar con un nombre de usuario, sin correo ni contraseña.
 *
 * El límite es más alto que el de antes porque ya no hay contraseña que
 * adivinar: crear identidades es barato y no hay nada que fuerza bruta.
 */
const guestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 60,
  message: 'Demasiadas entradas seguidas. Espera un momento.',
});

// POST /api/auth/guest - Entrar con un nombre
authRouter.post(
  '/guest',
  guestLimiter,
  asyncHandler(async (req: AuthRequest, res) => {
    const { username } = (req.body ?? {}) as Record<string, unknown>;

    const clean = validateUsername(username);
    const result = await enterAsGuest(clean);

    res.json(result);
  }),
);

// GET /api/auth/me - Quién soy en esta sesión
authRouter.get(
  '/me',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const user = await getUserById(req.userId!);
    res.json({ user });
  }),
);
