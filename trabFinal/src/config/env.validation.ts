/** Falha rápido na inicialização se a configuração obrigatória estiver ausente ou fraca. */
export function validateEnv(config: Record<string, unknown>) {
  const errors: string[] = [];
  if (!config.DATABASE_URL) errors.push('DATABASE_URL é obrigatória');
  const secret = String(config.JWT_SECRET ?? '');
  if (secret.length < 32) errors.push('JWT_SECRET deve ter pelo menos 32 caracteres');
  if (errors.length > 0) throw new Error(`Configuração inválida: ${errors.join('; ')}`);
  return config;
}
