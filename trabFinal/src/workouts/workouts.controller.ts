import {
  Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/types/auth-user';
import { CreateWorkoutDto } from './dto/create-workout.dto';
import { UpdateWorkoutDto } from './dto/update-workout.dto';
import { WorkoutQueryDto } from './dto/workout-query.dto';
import { WorkoutsService } from './workouts.service';

@ApiTags('workouts')
@ApiBearerAuth()
@Controller('workouts')
export class WorkoutsController {
  constructor(private readonly workouts: WorkoutsService) {}

  @Roles(Role.ADMIN, Role.TRAINER)
  @Post()
  create(@Body() dto: CreateWorkoutDto, @CurrentUser() user: AuthUser) {
    return this.workouts.create(dto, user);
  }

  /** Resposta traz o header X-Cache: HIT | MISS para evidenciar o cache. */
  @Get()
  async findAll(
    @Query() q: WorkoutQueryDto,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { payload, cacheHit } = await this.workouts.findAll(user, q);
    res.setHeader('X-Cache', cacheHit ? 'HIT' : 'MISS');
    return payload;
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.workouts.findOne(id, user);
  }

  @Roles(Role.ADMIN, Role.TRAINER)
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateWorkoutDto, @CurrentUser() user: AuthUser) {
    return this.workouts.update(id, dto, user);
  }

  @Roles(Role.ADMIN, Role.TRAINER)
  @HttpCode(204)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.workouts.remove(id, user);
  }
}
