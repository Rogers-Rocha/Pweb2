import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { sanitizeValue } from '../utils/sanitize.util';

/**
 * 2ª camada: sanitização básica de body e query ANTES da validação (DTOs).
 * Ela só normaliza dados; quem decide se o dado é aceitável é o ValidationPipe.
 */
@Injectable()
export class SanitizeMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeValue(req.body);
    }
    if (req.query && Object.keys(req.query).length > 0) {
      req.query = sanitizeValue(req.query) as Request['query'];
    }
    next();
  }
}
