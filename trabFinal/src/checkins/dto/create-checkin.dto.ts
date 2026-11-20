import { IsOptional, IsUUID } from 'class-validator';

export class CreateCheckinDto {
  /** Obrigatório para ADMIN/TRAINER. Para MEMBER é ignorado/validado contra o próprio perfil. */
  @IsOptional()
  @IsUUID()
  memberId?: string;
}
