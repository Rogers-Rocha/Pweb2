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
docker compose up --build            # use --scale api=4 para mais réplicas; LB_PORT=8088 se a 8080 estiver ocupada
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

## Deploy — API no Render + frontend na Vercel

> **Links em produção:** API `https://<gym-api>.onrender.com/api` · Swagger `https://<gym-api>.onrender.com/docs` · Frontend `https://<seu-front>.vercel.app`
> _(substituir pelos links reais após o deploy)_

- **CI:** `.github/workflows/ci-cd.yml` (migrações, typecheck, testes, build da API, build do frontend e imagem Docker).
- **CD:** Render e Vercel ligados ao repositório; publicam automaticamente a cada push na `main` (o Render só depois que o CI passa — `autoDeployTrigger: checksPass`).

### 1) Backend + PostgreSQL no Render (Blueprint)
1. <https://dashboard.render.com> → **New → Blueprint** → escolha este repositório. O Render lê o [`render.yaml`](../render.yaml) da raiz e cria:
   - `gym-db` (PostgreSQL free) e
   - `gym-api` (Docker, *Root Directory* `trabFinal`, health check `/api/health`, `JWT_SECRET` gerado automaticamente).
2. Ele vai pedir duas variáveis:
   - `SEED_ADMIN_PASSWORD`: senha do admin inicial (≥ 10 caracteres, não óbvia). O admin `admin@gym.local` é criado na inicialização (seed idempotente).
   - `CORS_ORIGINS`: deixe por enquanto `http://localhost:5173`. Depois do passo 2, troque pela URL da Vercel.
3. Aguarde o deploy e teste: `curl https://<gym-api>.onrender.com/api/health`.

### 2) Frontend na Vercel
1. <https://vercel.com/new> → importe este repositório → **Root Directory = `frontend`** (preset Vite é detectado).
2. Em **Environment Variables**: `VITE_API_URL = https://<gym-api>.onrender.com` (sem `/api` e sem barra no final).
3. **Deploy**. Copie a URL de produção (ex.: `https://gym-xyz.vercel.app`).
4. No Render → `gym-api` → **Environment** → `CORS_ORIGINS = https://gym-xyz.vercel.app` → *Save* (reinicia a API).

### Observações do plano gratuito
- A API "dorme" após 15 min sem uso; a primeira requisição leva ~1 min para acordar. **Abra o site uns minutos antes da apresentação.**
- O PostgreSQL free do Render expira após 30 dias.
- O plano free do Render não permite várias instâncias. Por isso o **load balancing é demonstrado com o Docker Compose** (2 réplicas + nginx, seção acima), o que o enunciado aceita. Em plano pago basta colocar `numInstances: 2` no `render.yaml`, e o `X-Instance-Id` mostra a réplica que respondeu.

O `fly.toml` continua no repositório como alternativa (Fly.io com `min_machines_running = 2`).
