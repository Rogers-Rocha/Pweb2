#!/bin/sh
set -e

# Em compose/local: RUN_MIGRATIONS=true aplica as migrações ao subir (o Prisma usa advisory lock,
# então réplicas iniciando juntas não conflitam). No Fly.io as migrações rodam no release_command.
if [ "$RUN_MIGRATIONS" = "true" ]; then
  echo "[entrypoint] Aplicando migrações..."
  npx prisma migrate deploy
fi

# No Render (plano free, sem shell) o admin inicial é criado aqui. O seed é idempotente (upsert)
# e, com NODE_ENV=production, cria somente o admin com a senha de SEED_ADMIN_PASSWORD.
if [ -n "$SEED_ADMIN_PASSWORD" ]; then
  echo "[entrypoint] Garantindo usuário admin inicial (seed)..."
  node prisma/seed.js || echo "[entrypoint] Aviso: seed falhou (a API sobe mesmo assim)."
fi

exec node dist/main.js
