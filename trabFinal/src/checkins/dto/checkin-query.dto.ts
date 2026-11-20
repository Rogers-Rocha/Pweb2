import { IsISO8601, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class CheckinQueryDto extends PaginationDto {
  /** Ignorado para MEMBER (sempre filtra pelo próprio perfil). */
  @IsOptional()
  @IsUUID()
  memberId?: string;

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;
}
