import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { buildMeta, toSkipTake } from '../common/dto/pagination.dto';
import { AuthUser } from '../common/types/auth-user';
import { hashPassword } from '../common/utils/password';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMemberDto } from './dto/create-member.dto';
import { MemberQueryDto } from './dto/member-query.dto';
import { UpdateMemberDto } from './dto/update-member.dto';

const memberInclude = {
  user: { select: { id: true, name: true, email: true } },
} satisfies Prisma.MemberInclude;

type MemberWithUser = Prisma.MemberGetPayload<{ include: typeof memberInclude }>;

const toView = (m: MemberWithUser) => ({
  id: m.id,
  userId: m.userId,
  name: m.user.name,
  email: m.user.email,
  phone: m.phone,
  birthDate: m.birthDate,
  plan: m.plan,
  status: m.status,
  createdAt: m.createdAt,
});

@Injectable()
export class MembersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateMemberDto) {
    const member = await this.prisma.member.create({
      data: {
        phone: dto.phone,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
        plan: dto.plan,
        user: {
          create: {
            email: dto.email.toLowerCase(),
            name: dto.name,
            role: Role.MEMBER,
            passwordHash: await hashPassword(dto.password),
          },
        },
      },
      include: memberInclude,
    });
    return toView(member);
  }

  async findAll(q: MemberQueryDto) {
    const where: Prisma.MemberWhereInput = {
      ...(q.status ? { status: q.status } : {}),
      ...(q.plan ? { plan: q.plan } : {}),
      ...(q.search
        ? {
            user: {
              OR: [
                { name: { contains: q.search, mode: 'insensitive' } },
                { email: { contains: q.search, mode: 'insensitive' } },
              ],
            },
          }
        : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.member.count({ where }),
      this.prisma.member.findMany({
        where,
        include: memberInclude,
        orderBy: { createdAt: 'desc' },
        ...toSkipTake(q.page, q.limit),
      }),
    ]);
    return { data: rows.map(toView), meta: buildMeta(total, q.page, q.limit) };
  }

  async findMine(user: AuthUser) {
    if (!user.memberId) throw new NotFoundException('Perfil de membro não encontrado');
    return this.findOne(user.memberId, user);
  }

  /** Autorização em nível de objeto: um MEMBER só enxerga o próprio cadastro. */
  async findOne(id: string, user: AuthUser) {
    if (user.role === Role.MEMBER && user.memberId !== id) {
      throw new ForbiddenException('Você só pode acessar o seu próprio cadastro');
    }
    const member = await this.prisma.member.findUnique({ where: { id }, include: memberInclude });
    if (!member) throw new NotFoundException('Membro não encontrado');
    return toView(member);
  }

  async update(id: string, dto: UpdateMemberDto) {
    const member = await this.prisma.member.update({
      where: { id }, // P2025 (não encontrado) vira 404 no filtro global
      data: {
        phone: dto.phone,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
        plan: dto.plan,
        status: dto.status,
        ...(dto.name ? { user: { update: { name: dto.name } } } : {}),
      },
      include: memberInclude,
    });
    return toView(member);
  }
}
