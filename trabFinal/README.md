# Gym API

API RESTful de gestão de academia — **NestJS + PostgreSQL + Prisma + node-cache**.
Documentação detalhada (pipeline, OWASP ASVS, cache, load balancing, CI/CD): [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md).

## Requisitos
Node 20+ e Docker (para o PostgreSQL / réplicas).

## Rodar em desenvolvimento
```bash
cp .env.example .env          # ajuste JWT_SECRET (>= 32 caracteres)
docker compose up -d db       # só o PostgreSQL
npm install
npx prisma migrate deploy     # aplica as migrações
npm run prisma:seed           # cria admin/trainer/member de demonstração
npm run start:dev
```
- API: `http://localhost:3000/api` · Swagger: `http://localhost:3000/docs`
- Testes: `npm test` · Typecheck: `npm run typecheck`

Usuários do seed (somente desenvolvimento):

| Papel | E-mail | Senha |
|---|---|---|
| ADMIN | admin@gym.local | `Admin@12345678` |
| TRAINER | trainer@gym.local | `Trainer@12345678` |
| MEMBER | member@gym.local | `Member@12345678` |

## Rodar com load balancer (2 réplicas + nginx)
```bash
export JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")
docker compose up --build            # use --scale api=4 para mais réplicas
DATABASE_URL="postgresql://gym:gym_dev_password@localhost:5432/gym?schema=public" npm run prisma:seed
for i in $(seq 1 8); do curl -si http://localhost:8080/api/health | grep -i x-instance-id; done
```

## Endpoints (prefixo `/api`)
| Método | Rota | Papéis |
|---|---|---|
| POST | `/auth/login` | público |
| GET | `/auth/me` | autenticado |
| GET | `/health` | público |
| POST, GET | `/users` | ADMIN |
| POST, GET | `/members` | ADMIN, TRAINER |
| GET | `/members/me` | MEMBER |
| GET | `/members/:id` | ADMIN, TRAINER, MEMBER (só o próprio) |
| PATCH | `/members/:id` | ADMIN, TRAINER |
| POST, PATCH, DELETE | `/workouts[/:id]` | ADMIN, TRAINER (trainer só os seus) |
| GET | `/workouts[/:id]` | autenticado (membro: próprios + modelos) |
| POST | `/checkins` | ADMIN/TRAINER (com `memberId`), MEMBER (próprio) |
| GET | `/checkins?memberId&from&to&page&limit` | autenticado (membro: só os seus) |

Exemplo:
```bash
TOKEN=$(curl -s localhost:3000/api/auth/login -H 'content-type: application/json' \
  -d '{"email":"admin@gym.local","password":"Admin@12345678"}' | node -pe "JSON.parse(require('fs').readFileSync(0)).accessToken")
curl -si localhost:3000/api/workouts -H "authorization: Bearer $TOKEN" | grep -i x-cache   # MISS
curl -si localhost:3000/api/workouts -H "authorization: Bearer $TOKEN" | grep -i x-cache   # HIT
```

## Variáveis de ambiente
Veja [`.env.example`](.env.example). Obrigatórias: `DATABASE_URL` e `JWT_SECRET` (≥ 32 caracteres).

## Deploy (Fly.io + GitHub Actions)
1. `fly launch --no-deploy --copy-config` (ajuste o `app` em `fly.toml`).
2. Banco PostgreSQL gerenciado (Fly Postgres, Neon, Supabase…) e então:
   `fly secrets set DATABASE_URL="postgresql://..." JWT_SECRET="$(openssl rand -hex 48)" SEED_ADMIN_PASSWORD="<senha forte>" CORS_ORIGINS="https://seu-front"`
3. `fly tokens create deploy` → salve o resultado como secret **`FLY_API_TOKEN`** no repositório GitHub.
4. `git push origin main` — o workflow testa, constrói e faz o deploy (migrações via `release_command`; 2 réplicas).
5. Seed do admin em produção: `fly ssh console -C "node prisma/seed.js"`.

Outras plataformas com réplicas (Render, Railway, Cloud Run) funcionam com o mesmo `Dockerfile`; basta trocar o job `deploy`.
