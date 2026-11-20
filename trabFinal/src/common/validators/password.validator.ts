import { registerDecorator, ValidationOptions } from 'class-validator';

/**
 * Lista curta de senhas comuns (>= 10 caracteres). Em produção, o ideal é checar contra uma
 * base maior (ex.: top 3000 / API Have I Been Pwned com k-anonymity).
 */
const COMMON_PASSWORDS = new Set([
  '1234567890', '12345678910', '123456789012', '0123456789', 'qwertyuiop', '1q2w3e4r5t',
  'password123', 'password12', 'passw0rd123', 'senha12345', 'senha123456', 'senhasenha',
  'mudar12345', 'admin12345', 'administrator', 'abcdefghij', 'iloveyou12', 'letmein1234',
]);

export function IsNotCommonPassword(options?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: 'isNotCommonPassword',
      target: object.constructor,
      propertyName,
      options: { message: 'Senha muito comum; escolha outra', ...options },
      validator: {
        validate: (value: unknown) => typeof value === 'string' && !COMMON_PASSWORDS.has(value.toLowerCase()),
      },
    });
}
