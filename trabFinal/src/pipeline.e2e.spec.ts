/**
 * Teste de integração do PIPELINE (middlewares, guards, pipes, filtro) com o Prisma simulado.
 * Não precisa de banco: valida autenticação, autorização, validação, sanitização, erros e cache.
 */
process.env.DATABASE_URL = 'postgresql://u:p@localhost:5432/db';
process.env.JWT_SECRET = 'segredo-de-teste-com-mais-de-32-caracteres-ok';
process.env.CACHE_TTL_SECONDS = '60';

import { Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { PrismaService } from './prisma/prisma.service';

const ADMIN = { id: '11111111-1111-4111-8111-111111111111', email: 'admin@gym.local', name: 'Admin', role: 'ADMIN', isActive: true, failedLoginAttempts: 0, lockedUntil: null, member: null, passwordHash: '' };
const MEMBER = { id: '22222222-2222-4222-8222-222222222222', email: 'member@gym.local', name: 'Membro', role: 'MEMBER', isActive: true, failedLoginAttempts: 0, lockedUntil: null, member: { id: '33333333-3333-4333-8333-333333333333' }, passwordHash: '' };
const PASSWORD = 'Senha-Forte-123';

function buildPrismaMock() {
  const users = [ADMIN, MEMBER];
  const workoutFindMany = jest.fn().mockResolvedValue([{ id: 'w1', title: 'Treino', createdAt: new Date() }]);
  return {
    workoutFindMany,
    mock: {
      user: {
        findUnique: jest.fn(({ where }: { where: { id?: string; email?: string } }) =>
          Promise.resolve(users.find((u) => u.id === where.id || u.email === where.email) ?? null)),
        update: jest.fn(({ where, data }: any) => Promise.resolve({ ...users.find((u) => u.id === where.id), failedLoginAttempts: 1, ...data })),
        count: jest.fn().mockResolvedValue(2),
        findMany: jest.fn().mockResolvedValue([]),
      },
      workout: { count: jest.fn().mockResolvedValue(1), findMany: workoutFindMany },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
      $queryRaw: jest.fn().mockResolvedValue([1]),
      onModuleInit: jest.fn(),
      onModuleDestroy: jest.fn(),
    },
  };
}

async function createApp() {
  const { mock, workoutFindMany } = buildPrismaMock();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue(mock)
    .compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false });
  configureApp(app);
  await app.init();
  return { app, workoutFindMany };
}

describe('Pipeline da API', () => {
  let app: NestExpressApplication;
  let workoutFindMany: jest.Mock;
  let adminToken: string;
  let memberToken: string;

  beforeAll(async () => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    ADMIN.passwordHash = await bcrypt.hash(PASSWORD, 4);
    MEMBER.passwordHash = ADMIN.passwordHash;
    ({ app, workoutFindMany } = await createApp());
    // Apenas 2 logins aqui: o login tem rate limit de 5/min por IP (os demais testes usam estes tokens).
    adminToken = await login(ADMIN.email);
    memberToken = await login(MEMBER.email);
  });
  afterAll(async () => app.close());

  const login = async (email: string) =>
    (await request(app.getHttpServer()).post('/api/auth/login').send({ email, password: PASSWORD })).body.accessToken as string;

  it('rota protegida sem token -> 401 padronizado, com X-Request-Id e sem detalhes internos', async () => {
    const res = await request(app.getHttpServer()).get('/api/members');
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ statusCode: 401, error: 'Unauthorized', path: '/api/members' });
    expect(res.body.requestId).toBe(res.headers['x-request-id']);
    expect(JSON.stringify(res.body)).not.toMatch(/stack|at .*\(/);
  });

  it('adiciona cabeçalhos de segurança (helmet) e não expõe X-Powered-By', async () => {
    const res = await request(app.getHttpServer()).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('validação: campos inválidos e propriedades extras -> 400 com details', async () => {
    const res = await request(app.getHttpServer()).post('/api/auth/login').send({ email: 'nao-e-email', password: 'x', isAdmin: true });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Dados inválidos');
    const fields = res.body.details.map((d: { field: string }) => d.field).sort();
    expect(fields).toEqual(['email', 'isAdmin']);
  });

  it('JSON malformado -> 400 padronizado', async () => {
    const res = await request(app.getHttpServer()).post('/api/auth/login').set('Content-Type', 'application/json').send('{"email":');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Bad Request');
  });

  it('rota inexistente -> 404 padronizado', async () => {
    const res = await request(app.getHttpServer()).get('/api/nao-existe');
    expect(res.status).toBe(404);
    expect(res.body.statusCode).toBe(404);
  });

  it('login válido emite JWT; /auth/me retorna o usuário', async () => {
    expect(adminToken).toBeDefined();
    const me = await request(app.getHttpServer()).get('/api/auth/me').set('Authorization', `Bearer ${adminToken}`);
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({ email: ADMIN.email, role: 'ADMIN' });
  });

  it('login com senha errada e com e-mail inexistente retornam a MESMA mensagem (anti-enumeração)', async () => {
    const wrongPw = await request(app.getHttpServer()).post('/api/auth/login').send({ email: ADMIN.email, password: 'errada-errada' });
    const unknown = await request(app.getHttpServer()).post('/api/auth/login').send({ email: 'ninguem@gym.local', password: 'errada-errada' });
    expect(wrongPw.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrongPw.body.message).toBe(unknown.body.message);
  });

  it('RBAC: MEMBER não acessa /users (403) e ADMIN acessa (200)', async () => {
    expect((await request(app.getHttpServer()).get('/api/users').set('Authorization', `Bearer ${memberToken}`)).status).toBe(403);
    expect((await request(app.getHttpServer()).get('/api/users').set('Authorization', `Bearer ${adminToken}`)).status).toBe(200);
  });

  it('BOLA: MEMBER não lê o cadastro de outro membro (403)', async () => {
    const res = await request(app.getHttpServer()).get('/api/members/99999999-9999-4999-8999-999999999999').set('Authorization', `Bearer ${memberToken}`);
    expect(res.status).toBe(403);
  });

  it('token adulterado / algoritmo "none" é rejeitado', async () => {
    const none = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: ADMIN.id })).toString('base64url')}.`;
    const res = await request(app.getHttpServer()).get('/api/auth/me').set('Authorization', `Bearer ${none}`);
    expect(res.status).toBe(401);
  });

  it('cache: 1ª listagem MISS, 2ª HIT (sem nova consulta ao banco); escopo do membro é isolado', async () => {
    const a1 = await request(app.getHttpServer()).get('/api/workouts').set('Authorization', `Bearer ${adminToken}`);
    const a2 = await request(app.getHttpServer()).get('/api/workouts').set('Authorization', `Bearer ${adminToken}`);
    expect(a1.headers['x-cache']).toBe('MISS');
    expect(a2.headers['x-cache']).toBe('HIT');
    expect(workoutFindMany).toHaveBeenCalledTimes(1);
    const m1 = await request(app.getHttpServer()).get('/api/workouts').set('Authorization', `Bearer ${memberToken}`);
    expect(m1.headers['x-cache']).toBe('MISS'); // chave diferente: não reaproveita o cache do staff
  });
});

describe('Rate limiting do login', () => {
  it('a 6ª tentativa no mesmo minuto retorna 429', async () => {
    const { app } = await createApp();
    let last = 0;
    for (let i = 0; i < 6; i++) {
      last = (await request(app.getHttpServer()).post('/api/auth/login').send({ email: 'x@y.com', password: 'qualquer-senha' })).status;
    }
    expect(last).toBe(429);
    await app.close();
  });
});
