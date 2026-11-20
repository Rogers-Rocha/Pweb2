import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { hashPassword, verifyPassword } from '../common/utils/password';
import { LOCK_MINUTES, MAX_FAILED_ATTEMPTS } from './auth.constants';

const GENERIC_ERROR = 'Credenciais inválidas ou conta temporariamente bloqueada';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  /** Hash "isca": usado quando o e-mail não existe, para igualar o tempo de resposta (anti-enumeração). */
  private dummyHash: Promise<string> = hashPassword('senha-isca-para-igualar-tempo');

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });

    if (!user || !user.isActive) {
      await verifyPassword(password, await this.dummyHash);
      this.logger.warn(JSON.stringify({ event: 'login_failed', reason: 'unknown_or_inactive' }));
      throw new UnauthorizedException(GENERIC_ERROR);
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      this.logger.warn(JSON.stringify({ event: 'login_blocked', userId: user.id }));
      throw new UnauthorizedException(GENERIC_ERROR);
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      const updated = await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: { increment: 1 } },
      });
      if (updated.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { failedLoginAttempts: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000) },
        });
        this.logger.warn(JSON.stringify({ event: 'account_locked', userId: user.id }));
      } else {
        this.logger.warn(JSON.stringify({ event: 'login_failed', userId: user.id }));
      }
      throw new UnauthorizedException(GENERIC_ERROR);
    }

    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      await this.prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts: 0, lockedUntil: null } });
    }

    const accessToken = await this.jwt.signAsync({ sub: user.id, role: user.role });
    this.logger.log(JSON.stringify({ event: 'login_success', userId: user.id }));

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: this.config.get<string>('JWT_EXPIRES_IN') ?? '30m',
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    };
  }
}
