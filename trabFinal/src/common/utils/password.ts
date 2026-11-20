import * as bcrypt from 'bcryptjs';

/** Fator de custo do bcrypt (OWASP recomenda >= 10; usamos 12). */
export const BCRYPT_ROUNDS = 12;

export const hashPassword = (plain: string) => bcrypt.hash(plain, BCRYPT_ROUNDS);
export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);
