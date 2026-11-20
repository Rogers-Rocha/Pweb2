import { ArgumentsHost, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AllExceptionsFilter } from './all-exceptions.filter';

function run(exception: unknown) {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getRequest: () => ({ originalUrl: '/api/x?token=segredo', requestId: 'rid-1' }),
      getResponse: () => ({ status }),
    }),
  } as unknown as ArgumentsHost;
  // silencia o log de erro esperado nos testes
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  new AllExceptionsFilter().catch(exception, host);
  return { code: status.mock.calls[0][0] as number, body: json.mock.calls[0][0] };
}

describe('AllExceptionsFilter', () => {
  it('padroniza HttpException e remove a query string do path', () => {
    const { code, body } = run(new ForbiddenException('Sem permissão'));
    expect(code).toBe(403);
    expect(body).toMatchObject({ statusCode: 403, error: 'Forbidden', message: 'Sem permissão', path: '/api/x', requestId: 'rid-1' });
    expect(body.timestamp).toBeDefined();
  });

  it('mantém details de validação', () => {
    const { body } = run(new BadRequestException({ message: 'Dados inválidos', details: [{ field: 'email', messages: ['inválido'] }] }));
    expect(body.details).toEqual([{ field: 'email', messages: ['inválido'] }]);
  });

  it('mapeia P2002 do Prisma para 409 sem vazar detalhes', () => {
    const err = new Prisma.PrismaClientKnownRequestError('Unique constraint failed on users_email_key', {
      code: 'P2002',
      clientVersion: 'test',
    });
    const { code, body } = run(err);
    expect(code).toBe(409);
    expect(JSON.stringify(body)).not.toContain('users_email_key');
  });

  it('erro desconhecido vira 500 genérico, sem stack trace', () => {
    const { code, body } = run(new Error('connection string postgres://user:pass@db'));
    expect(code).toBe(500);
    expect(body.message).toBe('Erro interno do servidor');
    expect(JSON.stringify(body)).not.toContain('postgres://');
    expect(body.stack).toBeUndefined();
  });

  it('JSON inválido (body-parser) vira 400', () => {
    const { code, body } = run(Object.assign(new Error('Unexpected token'), { status: 400, type: 'entity.parse.failed' }));
    expect(code).toBe(400);
    expect(body.message).toBe('JSON inválido');
  });
});
