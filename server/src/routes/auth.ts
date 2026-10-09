import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { authLimiter } from '../middleware/rateLimit';
import { registerUser, loginUser, getUserById } from '../services/authService';

export const authRouter = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,30}$/;
const MIN_PASSWORD = 6;

function validateCredentials(email: unknown, username: unknown, password: unknown) {
  if (typeof email !== 'string' || typeof username !== 'string' || typeof password !== 'string') {
    return 'Email, username y password son requeridos';
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanUsername = username.trim();

  if (!EMAIL_RE.test(cleanEmail)) return 'El email no tiene un formato válido';

  if (!USERNAME_RE.test(cleanUsername)) {
    return 'El username debe tener 3-30 caracteres (letras, números, . _ -)';
  }

  if (password.length < MIN_PASSWORD) {
    return `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres`;
  }

  if (password.length > 200) return 'La contraseña es demasiado larga';

  return null;
}

// POST /api/auth/register
authRouter.post('/register', authLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const { email, username, password } = req.body ?? {};

    const invalid = validateCredentials(email, username, password);
    if (invalid) return res.status(400).json({ error: invalid });

    const result = await registerUser(
      email.trim().toLowerCase(),
      username.trim(),
      password as string,
    );
    res.status(201).json(result);
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Error interno' });
    }
  }
});

// POST /api/auth/login
authRouter.post('/login', authLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const { email, password } = req.body ?? {};

    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
      return res.status(400).json({ error: 'Email y password son requeridos' });
    }

    const result = await loginUser(email.trim().toLowerCase(), password);
    res.json(result);
  } catch (error) {
    // Mensaje genérico: no revela si el email existe o no
    res.status(401).json({ error: error instanceof Error ? error.message : 'Credenciales inválidas' });
  }
});

// GET /api/auth/me
authRouter.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await getUserById(req.userId!);
    res.json({ user });
  } catch (error) {
    if (error instanceof Error) {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Error interno' });
    }
  }
});