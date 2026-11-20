import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { createHash } from 'crypto';
import { AppCacheService } from '../cache/cache.service';
import { buildMeta, toSkipTake } from '../common/dto/pagination.dto';
import { AuthUser } from '../common/types/auth-user';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkoutDto } from './dto/create-workout.dto';
import { UpdateWorkoutDto } from './dto/update-workout.dto';
import { WorkoutQueryDto } from './dto/workout-query.dto';

/** Prefixo de todas as chaves de cache desta entidade (usado na invalidação explícita). */
export const WORKOUTS_CACHE_PREFIX = 'workouts:';

const workoutInclude = {
  trainer: { select: { id: true, name: true } },
} satisfies Prisma.WorkoutInclude;

@Injectable()
export class WorkoutsService {
  constructor(private readonly prisma: PrismaService, private readonly cache: AppCacheService) {}

  /**
   * Listagem com cache. A chave inclui o ESCOPO do usuário (staff x membro específico) e os filtros,
   * para que um membro nunca receba uma resposta cacheada de outro.
   */
  async findAll(user: AuthUser, q: WorkoutQueryDto) {
    const where = this.buildWhere(user, q);
    const scope = user.role === Role.MEMBER ? `member:${user.memberId}` : 'staff';
    const digest = createHash('sha256')
      .update(JSON.stringify([q.page, q.limit, q.level ?? null, q.search ?? null, q.memberId ?? null]))
      .digest('hex')
      .slice(0, 32);
    const key = `${WORKOUTS_CACHE_PREFIX}list:${scope}:${digest}`;

    const { value, hit } = await this.cache.wrap(key, async () => {
      const [total, data] = await this.prisma.$transaction([
        this.prisma.workout.count({ where }),
        this.prisma.workout.findMany({
          where,
          include: workoutInclude,
          orderBy: { createdAt: 'desc' },
          ...toSkipTake(q.page, q.limit),
        }),
      ]);
      return { data, meta: buildMeta(total, q.page, q.limit) };
    });
    return { payload: value, cacheHit: hit };
  }

  async findOne(id: string, user: AuthUser) {
    const workout = await this.prisma.workout.findUnique({ where: { id }, include: workoutInclude });
    if (!workout) throw new NotFoundException('Treino não encontrado');
    this.assertCanRead(workout.memberId, user);
    return workout;
  }

  async create(dto: CreateWorkoutDto, user: AuthUser) {
    if (dto.memberId) await this.assertMemberExists(dto.memberId);
    const workout = await this.prisma.workout.create({
      data: {
        title: dto.title,
        description: dto.description,
        level: dto.level,
        durationMin: dto.durationMin,
        exercises: dto.exercises as unknown as Prisma.InputJsonValue,
        memberId: dto.memberId,
        trainerId: user.id,
      },
      include: workoutInclude,
    });
    this.cache.invalidatePrefix(WORKOUTS_CACHE_PREFIX);
    return workout;
  }

  async update(id: string, dto: UpdateWorkoutDto, user: AuthUser) {
    await this.assertCanModify(id, user);
    if (dto.memberId) await this.assertMemberExists(dto.memberId);
    const workout = await this.prisma.workout.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        level: dto.level,
        durationMin: dto.durationMin,
        exercises: dto.exercises as unknown as Prisma.InputJsonValue | undefined,
        memberId: dto.memberId,
      },
      include: workoutInclude,
    });
    this.cache.invalidatePrefix(WORKOUTS_CACHE_PREFIX);
    return workout;
  }

  async remove(id: string, user: AuthUser) {
    await this.assertCanModify(id, user);
    await this.prisma.workout.delete({ where: { id } });
    this.cache.invalidatePrefix(WORKOUTS_CACHE_PREFIX);
  }

  // ---------- helpers ----------

  private buildWhere(user: AuthUser, q: WorkoutQueryDto): Prisma.WorkoutWhereInput {
    const where: Prisma.WorkoutWhereInput = {
      ...(q.level ? { level: q.level } : {}),
      ...(q.search ? { title: { contains: q.search, mode: 'insensitive' } } : {}),
    };
    if (user.role === Role.MEMBER) {
      // Atenção: `memberId: undefined` seria IGNORADO pelo Prisma e vazaria tudo. Por isso a checagem.
      if (!user.memberId) throw new ForbiddenException('Perfil de membro não encontrado');
      // Membro vê os próprios treinos + treinos modelo (sem membro atribuído).
      where.OR = [{ memberId: user.memberId }, { memberId: null }];
    } else if (q.memberId) {
      where.memberId = q.memberId;
    }
    return where;
  }

  private assertCanRead(workoutMemberId: string | null, user: AuthUser) {
    if (user.role !== Role.MEMBER) return;
    if (workoutMemberId !== null && workoutMemberId !== user.memberId) {
      throw new ForbiddenException('Você não tem acesso a este treino');
    }
  }

  /** ADMIN altera qualquer treino; TRAINER apenas os que ele mesmo criou. */
  private async assertCanModify(id: string, user: AuthUser) {
    const workout = await this.prisma.workout.findUnique({ where: { id }, select: { trainerId: true } });
    if (!workout) throw new NotFoundException('Treino não encontrado');
    if (user.role !== Role.ADMIN && workout.trainerId !== user.id) {
      throw new ForbiddenException('Você só pode alterar treinos criados por você');
    }
  }

  private async assertMemberExists(memberId: string) {
    const member = await this.prisma.member.findUnique({ where: { id: memberId }, select: { id: true } });
    if (!member) throw new NotFoundException('Membro não encontrado');
  }
}
