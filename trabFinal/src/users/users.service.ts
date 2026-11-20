import { Injectable } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { buildMeta, PaginationDto, toSkipTake } from '../common/dto/pagination.dto';
import { hashPassword } from '../common/utils/password';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';

const publicSelect = {
  id: true, email: true, name: true, role: true, isActive: true, createdAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateUserDto) {
    return this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        name: dto.name,
        role: dto.role as Role,
        passwordHash: await hashPassword(dto.password),
      },
      select: publicSelect,
    });
  }

  async findAll({ page, limit }: PaginationDto) {
    const [total, data] = await this.prisma.$transaction([
      this.prisma.user.count(),
      this.prisma.user.findMany({
        select: publicSelect,
        orderBy: { createdAt: 'desc' },
        ...toSkipTake(page, limit),
      }),
    ]);
    return { data, meta: buildMeta(total, page, limit) };
  }
}
