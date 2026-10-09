import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { authLimiter } from '../middleware/rateLimit';
import { registerUser, loginUser, getUserById } from '../services/authService';
import { validateEmail, validateUsername, validatePassword } from '../utils/validation';
import { asyncHandler } from '../utils/asyncHandler';

export const authRouter = Router();

// POST /api/auth/register
authRouter.post(
  '/register',
  authLimiter,
  asyncHandler(async (req: AuthRequest, res) => {
    const { email, username, password } = (req.body ?? {}) as Record<string, unknown>;

    // Cada validador lanza AppError con el codigo HTTP y el mensaje en espanol
    const cleanEmail = validateEmail(email);
    const cleanUsername = validateUsername(username);
    const cleanPassword = validatePassword(password);

    const result = await registerUser(cleanEmail, cleanUsername, cleanPassword);
    res.status(201).json(result);
  }),
);

// POST /api/auth/login
authRouter.post(
  '/login',
  authLimiter,
  asyncHandler(async (req: AuthRequest, res) => {
    const { email, password } = (req.body ?? {}) as Record<string, unknown>;

    const cleanEmail = validateEmail(email);
    // No se valida la longitud del password: un login fallido con cualquier
    // contrasena debe dar el mismo 401, sin revelar la politica de contrasenas
    const cleanPassword = typeof password === 'string' ? password : '';

    const result = await loginUser(cleanEmail, cleanPassword);
    res.json(result);
  }),
);

// GET /api/auth/me
authRouter.get(
  '/me',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const user = await getUserById(req.userId!);
    res.json({ user });
  }),
);
