import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { flattenValidationErrors } from './common/utils/validation.util';

/**
 * Configuração global compartilhada entre main.ts e os testes de integração.
 * Ordem (ver docs/ARQUITETURA.md): helmet -> CORS -> body parser -> [middlewares do AppModule] ->
 * guards -> ValidationPipe -> controller -> filtro de exceções.
 */
export function configureApp(app: NestExpressApplication) {
  const config = app.get(ConfigService);

  // Atrás de nginx/Fly/Render o IP real vem de X-Forwarded-For (necessário p/ rate limit correto).
  const trustProxy = Number(config.get('TRUST_PROXY') ?? 0);
  if (trustProxy > 0) app.set('trust proxy', trustProxy);

  app.use(helmet()); // 1) cabeçalhos de segurança
  const origins = (config.get<string>('CORS_ORIGINS') ?? '').split(',').map((o) => o.trim()).filter(Boolean);
  app.enableCors({ origin: origins.length > 0 ? origins : false, methods: ['GET', 'POST', 'PATCH', 'DELETE'] }); // 2) CORS
  app.useBodyParser('json', { limit: '100kb' }); // 3) parse do corpo com limite

  app.setGlobalPrefix('api');

  // Validação de entrada (DTOs)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // remove propriedades não declaradas no DTO
      forbidNonWhitelisted: true, // e rejeita a requisição se vierem propriedades extras
      transform: true,
      exceptionFactory: (errors) =>
        new BadRequestException({ message: 'Dados inválidos', details: flattenValidationErrors(errors) }),
    }),
  );
}
