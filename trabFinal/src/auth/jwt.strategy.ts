import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/types/auth-user';
import { JWT_AUDIENCE, JWT_ISSUER } from './auth.constants';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService, private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
      algorithms: ['HS256'], // allow-list explícita: rejeita "none" e troca de algoritmo
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
  }

  /** Recarrega o usuário a cada requisição: desativação e mudança de papel valem imediatamente. */
  async validate(payload: { sub: string }): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { member: { select: { id: true } } },
    });
    if (!user || !user.isActive) throw new UnauthorizedException();
    return { id: user.id, email: user.email, name: user.name, role: user.role, memberId: user.member?.id };
  }
}
