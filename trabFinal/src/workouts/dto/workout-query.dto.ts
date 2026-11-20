import { WorkoutLevel } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class WorkoutQueryDto extends PaginationDto {
  @IsOptional()
  @IsEnum(WorkoutLevel)
  level?: WorkoutLevel;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  /** Filtro disponível apenas para ADMIN/TRAINER. */
  @IsOptional()
  @IsUUID()
  memberId?: string;
}
