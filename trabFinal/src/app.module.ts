import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { AppCacheModule } from './cache/cache.module';
import { CheckinsModule } from './checkins/checkins.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware';
import { SanitizeMiddleware } from './common/middleware/sanitize.middleware';
import { validateEnv } from './config/env.validation';
import { HealthController } from './health/health.controller';
import { MembersModule } from './members/members.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { WorkoutsModule } from './workouts/workouts.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    // Limite global: 100 req/min por IP. O login tem limite próprio mais rígido.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    AppCacheModule,
    AuthModule,
    UsersModule,
    MembersModule,
    WorkoutsModule,
    CheckinsModule,
  ],
  controllers: [HealthController],
  providers: [
    // A ordem de registro dos guards globais define a ordem de execução.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Ordem importa: logging primeiro (registra inclusive requisições rejeitadas), depois sanitização.
    consumer.apply(RequestLoggerMiddleware, SanitizeMiddleware).forRoutes('*');
  }
}
