import { MemberStatus, Plan } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class UpdateMemberDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @Matches(/^[0-9+()\-\s]{8,20}$/, { message: 'phone deve conter 8 a 20 dígitos/símbolos de telefone' })
  phone?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  birthDate?: string;

  @IsOptional()
  @IsEnum(Plan)
  plan?: Plan;

  @IsOptional()
  @IsEnum(MemberStatus)
  status?: MemberStatus;
}
