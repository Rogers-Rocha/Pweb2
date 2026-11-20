#!/bin/sh
set -e

# Em compose/local: RUN_MIGRATIONS=true aplica as migrações ao subir (o Prisma usa advisory lock,
# então réplicas iniciando juntas não conflitam). No Fly.io as migrações rodam no release_command.
if [ "$RUN_MIGRATIONS" = "true" ]; then
  echo "[entrypoint] Aplicando migrações..."
  npx prisma migrate deploy
fi

exec node dist/main.js
