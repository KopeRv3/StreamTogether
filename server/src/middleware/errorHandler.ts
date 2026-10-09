import { Request, Response, NextFunction } from 'express';

/**
 * Error con codigo HTTP asociado. Los servicios lo lanzan para comunicar
 * fallos previstos (sala no encontrada, sin permisos, etc.) sin ensuciar
 * cada endpoint con try/catch.
 */
export class AppError extends Error {
  statusCode: number;
  code?: string;

  constructor(message: string, statusCode: number = 500, code?: string) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    // Necesario para que instanceof funcione al compilar a ES5
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: 'Ruta no encontrada' });
}

/**
 * Manejador de errores final. Debe registrarse el ultimo: Express solo lo
 * invoca si ningun middleware anterior lanzo.
 */
export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  // Si la respuesta ya empezo, delegar al handler por defecto de Express
  if (res.headersSent) {
    return;
  }

  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      console.error(`[error] ${err.code ?? 'APP'}: ${err.message}`);
    }
    res.status(err.statusCode).json({
      error: err.message,
      ...(err.code ? { code: err.code } : {}),
    });
    return;
  }

  // Errores de multer (subida de archivos) traen codigos propios
  if (err.name === 'MulterError') {
    const status = err.message === 'File too large' ? 413 : 400;
    const mensaje =
      err.message === 'File too large' ? 'El archivo supera el tamano maximo' : err.message;
    res.status(status).json({ error: mensaje });
    return;
  }

  // Un SyntaxError de JSON mal formado viene de express.json()
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ error: 'JSON invalido' });
    return;
  }

  // express.json() lanza PayloadTooLargeError si el body supera el limite.
  // Sin este caso el usuario veria un 500 en vez de un 413, que confunde
  // a quien intenta subir un archivo grande. El campo `type` no existe en el
  // tipo Error, asi que se comprueba de forma segura.
  const errType = (err as Error & { type?: string }).type;
  if (errType === 'entity.too.large') {
    res.status(413).json({ error: 'El cuerpo de la peticion es demasiado grande' });
    return;
  }

  console.error('[error] no controlado:', err);

  // En produccion nunca se filtran detalles internos al cliente
  const mensaje =
    process.env.NODE_ENV === 'production' ? 'Error interno del servidor' : err.message;

  res.status(500).json({ error: mensaje });
}
