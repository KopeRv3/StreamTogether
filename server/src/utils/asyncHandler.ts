import { Request, Response, NextFunction, RequestHandler } from 'express';
import { AppError } from '../middleware/errorHandler';

/**
 * Express 4 no captura rechazos de promesa en los handlers async: un
 * `await` que falla deja la peticion colgada para siempre hasta que el cliente
 * agota el tiempo de espera. Este wrapper lo resuelve y lo pasa a next(error).
 *
 *   roomsRouter.get('/:id', authMiddleware, asyncHandler(async (req, res) => { ... }))
 *
 * (Express 5 ya lo hace solo; el wrapper no hace falta al migrar.)
 */
export function asyncHandler<T extends RequestHandler>(handler: T): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

/** Convierte cualquier error en algo que el errorHandler sepa responder. */
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;

  if (error instanceof Error) {
    // Errores conocidos de Prisma con mensajes que el usuario puede entender
    const message = error.message;

    if (message.includes('Unique constraint')) {
      return new AppError('Ese valor ya esta en uso', 409, 'DUPLICADO');
    }

    if (message.includes('Foreign key constraint')) {
      return new AppError('La referencia indicada no existe', 400, 'REFERENCIA_INVALIDA');
    }

    if (message.includes('Database is locked') || message.includes('database is locked')) {
      return new AppError('La base de datos esta ocupada, reintenta', 503, 'DB_BLOQUEADA');
    }
  }

  return new AppError('Error interno del servidor', 500);
}
