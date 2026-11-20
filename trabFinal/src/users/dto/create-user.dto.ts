import { Role } from '@prisma/client';
import { IsEmail, IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import { IsNotCommonPassword } from '../../common/validators/password.validator';

export class CreateUserDto {
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  /** Política: 10 a 128 caracteres (sem regras de composição) e fora da lista de senhas comuns. */
  @IsString()
  @MinLength(10)
  @MaxLength(128)
  @IsNotCommonPassword()
  password: string;

  @IsIn([Role.ADMIN, Role.TRAINER])
  role: 'ADMIN' | 'TRAINER';
}
