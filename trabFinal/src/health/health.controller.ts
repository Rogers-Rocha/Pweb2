import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import * as os from 'os';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  /** Usado pelo load balancer / plataforma para saber se a réplica está saudável. */
  @Public()
  @SkipThrottle()
  @Get()
  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException('Serviço indisponível');
    }
    const expose = this.config.get<string>('EXPOSE_INSTANCE_ID') === 'true';
    return { status: 'ok', timestamp: new Date().toISOString(), ...(expose ? { instance: os.hostname() } : {}) };
  }
}
