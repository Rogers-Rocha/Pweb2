import {
  BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException,
} from '@nestjs/common';
import { MemberStatus, Prisma, Role } from '@prisma/client';
import { buildMeta, toSkipTake } from '../common/dto/pagination.dto';
import { AuthUser } from '../common/types/auth-user';
import { PrismaService } from '../prisma/prisma.service';
import { CheckinQueryDto } from './dto/checkin-query.dto';
import { CreateCheckinDto } from './dto/create-checkin.dto';

/** Regra de negócio: evita check-ins duplicados em sequência (duplo clique, reenvio). */
const MIN_INTERVAL_MS = 5 * 60 * 1000;

const checkinInclude = {
  member: { select: { id: true, user: { select: { name: true } } } },
} satisfies Prisma.CheckInInclude;

@Injectable()
export class CheckinsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCheckinDto, user: AuthUser) {
    let memberId: string;
    if (user.role === Role.MEMBER) {
      if (!user.memberId) throw new ForbiddenException('Perfil de membro não encontrado');
      if (dto.memberId && dto.memberId !== user.memberId) {
        throw new ForbiddenException('Você só pode registrar o seu próprio check-in');
      }
      memberId = user.memberId;
    } else {
      if (!dto.memberId) throw new BadRequestException('memberId é obrigatório');
      memberId = dto.memberId;
    }

    const member = await this.prisma.member.findUnique({
      where: { id: memberId },
      select: { id: true, status: true },
    });
    if (!member) throw new NotFoundException('Membro não encontrado');
    if (member.status !== MemberStatus.ACTIVE) throw new ForbiddenException('Membro inativo ou suspenso');

    const recent = await this.prisma.checkIn.findFirst({
      where: { memberId, checkedInAt: { gte: new Date(Date.now() - MIN_INTERVAL_MS) } },
      select: { id: true },
    });
    if (recent) throw new ConflictException('Check-in já registrado recentemente');

    return this.prisma.checkIn.create({
      data: { memberId, registeredById: user.id },
      include: checkinInclude,
    });
  }

  async findAll(user: AuthUser, q: CheckinQueryDto) {
    let memberId: string | undefined = q.memberId;
    if (user.role === Role.MEMBER) {
      if (!user.memberId) throw new ForbiddenException('Perfil de membro não encontrado');
      memberId = user.memberId; // força o escopo do próprio membro
    }

    const where: Prisma.CheckInWhereInput = {
      ...(memberId ? { memberId } : {}),
      ...(q.from || q.to
        ? { checkedInAt: { ...(q.from ? { gte: new Date(q.from) } : {}), ...(q.to ? { lte: new Date(q.to) } : {}) } }
        : {}),
    };

    const [total, data] = await this.prisma.$transaction([
      this.prisma.checkIn.count({ where }),
      this.prisma.checkIn.findMany({
        where,
        include: checkinInclude,
        orderBy: { checkedInAt: 'desc' },
        ...toSkipTake(q.page, q.limit),
      }),
    ]);
    return { data, meta: buildMeta(total, q.page, q.limit) };
  }
}
