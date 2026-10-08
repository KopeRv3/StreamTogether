import jwt from 'jsonwebtoken';
import { config } from '../config';

interface TokenPayload {
  userId: string;
  username: string;
}

export function generateToken(payload: TokenPayload): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, config.jwtSecret) as TokenPayload;
  } catch {
    return null;
  }
}