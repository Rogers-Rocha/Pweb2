import { Type } from 'class-transformer';
import { WorkoutLevel } from '@prisma/client';
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsEnum, IsInt, IsOptional, IsString, IsUUID,
  Max, MaxLength, Min, MinLength, ValidateNested,
} from 'class-validator';

export class ExerciseDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsInt()
  @Min(1)
  @Max(20)
  sets: number;

  @IsInt()
  @Min(1)
  @Max(100)
  reps: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(600)
  restSeconds?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string;
}

export class CreateWorkoutDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsEnum(WorkoutLevel)
  level: WorkoutLevel;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(300)
  durationMin?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ExerciseDto)
  exercises: ExerciseDto[];

  /** Se informado, o treino é atribuído a um membro; se omitido, é um treino modelo (visível a todos os membros). */
  @IsOptional()
  @IsUUID()
  memberId?: string;
}
