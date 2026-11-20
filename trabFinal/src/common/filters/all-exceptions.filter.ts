import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';
import { RequestWithId } from '../types/auth-user';

const STATUS_NAMES: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  409: 'Conflict',
  413: 'Payload Too Large',
  415: 'Unsupported Media Type',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  503: 'Service Unavailable',
};

export interface ErrorResponse {
  statusCode: number;
  error: string;
  message: string;
  details?: unknown;
  path: string;
  timestamp: string;
  requestId?: string;
}

/**
 * Última camada do pipeline: TODA exceção vira uma resposta padronizada.
 * Detalhes internos (stack, SQL, mensagens do Prisma) vão apenas para o log do servidor.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<RequestWithId>();
    const res = ctx.getResponse<Response>();

    const { status, message, details } = this.normalize(exception);

    const body: ErrorResponse = {
      statusCode: status,
      error: STATUS_NAMES[status] ?? 'Error',
      message,
      ...(details !== undefined ? { details } : {}),
      path: (req.originalUrl ?? req.url ?? '').split('?')[0],
      timestamp: new Date().toISOString(),
      requestId: req.requestId,
    };

    if (status >= 500) {
      this.logger.error(
        JSON.stringify({ requestId: req.requestId, path: body.path, status }),
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    res.status(status).json(body);
  }

  private normalize(exception: unknown): { status: number; message: string; details?: unknown } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      if (typeof response === 'string') return { status, message: response };
      const r = response as { message?: string | string[]; details?: unknown };
      if (Array.isArray(r.message)) return { status, message: 'Dados inválidos', details: r.message };
      return { status, message: r.message ?? exception.message, ...(r.details !== undefined ? { details: r.details } : {}) };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002':
          return { status: HttpStatus.CONFLICT, message: 'Já existe um registro com os dados informados' };
        case 'P2025':
          return { status: HttpStatus.NOT_FOUND, message: 'Registro não encontrado' };
        case 'P2003':
          return { status: HttpStatus.CONFLICT, message: 'Operação viola um relacionamento existente' };
        default:
          return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Erro interno do servidor' };
      }
    }

    // Erros de body-parser (JSON inválido, payload grande demais) chegam como Error com `status`/`type`.
    const ext = exception as { status?: number; type?: string } | null;
    if (ext && typeof ext.status === 'number' && ext.status >= 400 && ext.status < 500) {
      if (ext.type === 'entity.too.large') {
        return { status: 413, message: 'Corpo da requisição excede o limite permitido' };
      }
      if (ext.type === 'entity.parse.failed') {
        return { status: 400, message: 'JSON inválido' };
      }
      return { status: ext.status, message: 'Requisição inválida' };
    }

    return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Erro interno do servidor' };
  }
}
