import { Request, Response, NextFunction } from 'express';

/**
 * CORS que permite trabajar desde el celular sin configuracion extra.
 *
 * En DESARROLLO se aceptan los origenes de la red local (192.168.x.x,
 * 10.x.x.x, 172.16-31.x.x) ademas de localhost, porque al probar desde el
 * telefono el origen pasa a ser http://192.168.1.12:5173 y no esta escrito
 * en CLIENT_URL.
 *
 * En PRODUCCION solo se acepta la lista de CLIENT_URL, sin excepciones.
 */

const RED_LOCAL =
  /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?$/;

export function esOrigenLocal(origin: string): boolean {
  return RED_LOCAL.test(origin);
}

export function corsMiddleware(allowedOrigins: string[], isProduction: boolean) {
  const permitidos = new Set(allowedOrigins);

  return function cors(req: Request, res: Response, next: NextFunction) {
    const origin = req.headers.origin;

    // Sin origin: curl, Postman, apps moviles. No se puede bloquear sin
    // romper esas herramientas.
    if (!origin) return next();

    const permitido = permitidos.has(origin) || (!isProduction && esOrigenLocal(origin));

    if (!permitido) {
      // No se responde con 403: el error real lo dara el navegador al
      // bloquear la respuesta, y asi el mensaje es mas claro en consola.
      res.setHeader('Access-Control-Allow-Origin', 'null');
      return next();
    }

    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Origin, X-Requested-With, Content-Type, Accept, Authorization',
    );
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    next();
  };
}
