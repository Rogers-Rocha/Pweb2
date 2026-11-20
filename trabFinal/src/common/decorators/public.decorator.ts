import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
/** Marca uma rota como pública (ignora autenticação). Por padrão TODAS as rotas exigem JWT. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
