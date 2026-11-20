import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

async function bootstrap() {
  // bodyParser desligado para controlarmos o limite de tamanho do JSON (100 kb) em configureApp.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  configureApp(app);
  app.enableShutdownHooks();

  if (config.get<string>('SWAGGER_ENABLED') !== 'false') {
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('Gym API').setDescription('API de gestão de academia').setVersion('1.0').addBearerAuth().build(),
    );
    SwaggerModule.setup('docs', app, doc);
  }

  const port = Number(config.get('PORT') ?? 3000);
  await app.listen(port, '0.0.0.0');
  logger.log(`API em execução na porta ${port}`);
}

bootstrap();
