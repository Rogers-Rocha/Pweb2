import { Plan } from '@prisma/client';
import { IsDateString, IsEmail, IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { IsNotCommonPassword } from '../../common/validators/password.validator';

export class CreateMemberDto {
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  /** Senha inicial do membro. */
  @IsString()
  @MinLength(10)
  @MaxLength(128)
  @IsNotCommonPassword()
  password: string;

  @IsOptional()
  @Matches(/^[0-9+()\-\s]{8,20}$/, { message: 'phone deve conter 8 a 20 dígitos/símbolos de telefone' })
  phone?: string;

  /** Formato AAAA-MM-DD */
  @IsOptional()
  @IsDateString({ strict: true })
  birthDate?: string;

  @IsOptional()
  @IsEnum(Plan)
  plan?: Plan;
}
