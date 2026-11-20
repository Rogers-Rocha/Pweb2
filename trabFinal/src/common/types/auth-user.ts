import { Request } from 'express';
import { Role } from '@prisma/client';

/** Usuário autenticado, anexado a req.user pela JwtStrategy. */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  /** Preenchido apenas para usuários com perfil de membro. */
  memberId?: string;
}

export type RequestWithId = Request & { requestId?: string };
