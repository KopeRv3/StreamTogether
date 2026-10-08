import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { registerUser, loginUser, getUserById } from '../services/authService';

export const authRouter = Router();

// POST /api/auth/register
authRouter.post('/register', async (req: AuthRequest, res: Response) => {
  try {
    const { email, username, password } = req.body;

    if (!email || !username || !password) {
      return res.status(400).json({ error: 'Email, username y password son requeridos' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'El password debe tener al menos 6 caracteres' });
    }

    const result = await registerUser(email, username, password);
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
authRouter.post('/login', async (req: AuthRequest, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email y password son requeridos' });
    }

    const result = await loginUser(email, password);
    res.json(result);
  } catch (error) {
    if (error instanceof Error) {
      res.status(401).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Error interno' });
    }
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