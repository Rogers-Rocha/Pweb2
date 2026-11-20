import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { NextFunction, Response } from 'express';
import * as os from 'os';
import { AuthUser, RequestWithId } from '../types/auth-user';

/**
 * 1ª camada do pipeline da aplicação: gera um requestId (nunca confia em IDs vindos do cliente),
 * mede a duração e registra UMA linha JSON por requisição ao final da resposta.
 * Não registra corpo, query string, headers nem tokens (evita vazar dados sensíveis).
 */
@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');
  private readonly exposeInstance: boolean;

  constructor(config: ConfigService) {
    this.exposeInstance = config.get<string>('EXPOSE_INSTANCE_ID') === 'true';
  }

  use(req: RequestWithId, res: Response, next: NextFunction) {
    const start = process.hrtime.bigint();
    const requestId = randomUUID();
    req.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);
    if (this.exposeInstance) res.setHeader('X-Instance-Id', os.hostname());

    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
      const user = req.user as AuthUser | undefined;
      const line = JSON.stringify({
        requestId,
        method: req.method,
        path: req.originalUrl.split('?')[0],
        status: res.statusCode,
        durationMs: Math.round(durationMs * 100) / 100,
        ip: req.ip,
        userId: user?.id,
      });
      if (res.statusCode >= 500) this.logger.error(line);
      else if (res.statusCode >= 400) this.logger.warn(line);
      else this.logger.log(line);
    });

    next();
  }
}
