# Gym API — Documentação de arquitetura

API RESTful para gestão de academia. **Stack:** Node.js 20 · NestJS 10 · PostgreSQL 16 · Prisma 5 · node-cache · Docker · GitHub Actions · Render (API) · Vercel (frontend React).

## 1. Visão geral

```
Cliente ──HTTPS──▶ Load balancer (nginx local / proxy do Render)
                        ├──▶ Réplica 1 (NestJS) ─┐
                        └──▶ Réplica 2 (NestJS) ─┴──▶ PostgreSQL
```

Módulos: `auth` (login/JWT) · `users` (contas de equipe) · `members` · `workouts` · `checkins` · `health` · `prisma` · `cache`.

Papéis: **ADMIN**, **TRAINER**, **MEMBER**.

| Recurso | ADMIN | TRAINER | MEMBER |
|---|---|---|---|
| `POST /auth/login`, `GET /health` | público | público | público |
| `GET /auth/me` | ✔ | ✔ | ✔ |
| `POST/GET /users` | ✔ | ✘ | ✘ |
| `POST/GET/PATCH /members` | ✔ | ✔ | ✘ |
| `GET /members/me` | ✘ | ✘ | ✔ |
| `GET /members/:id` | ✔ | ✔ | só o próprio |
| `POST/PATCH/DELETE /workouts` | ✔ (todos) | ✔ (só os seus) | ✘ |
| `GET /workouts`, `GET /workouts/:id` | todos | todos | próprios + modelos |
| `POST /checkins` | ✔ (informa `memberId`) | ✔ (informa `memberId`) | só o próprio |
| `GET /checkins` | todos | todos | só os próprios |

Não há cadastro público: contas de equipe são criadas por ADMIN (`/users`) e membros por ADMIN/TRAINER (`/members`), o que reduz a superfície de ataque.

## 2. Pipeline de middlewares — ordem e responsabilidade

No NestJS o ciclo de vida de uma requisição é fixo: *middleware → guards → pipes → controller → filtros de exceção*. Por isso a **sanitização (middleware) ocorre antes da autenticação (guard)**; ela apenas normaliza dados e não toma decisões de segurança.

| # | Camada | Tipo | Arquivo | Responsabilidade |
|---|---|---|---|---|
| 1 | Helmet | middleware Express | `app.setup.ts` | Cabeçalhos de segurança (`X-Content-Type-Options`, HSTS, CSP…), remove `X-Powered-By`. |
| 2 | CORS | middleware Express | `app.setup.ts` | Só origens da env `CORS_ORIGINS`; vazio = CORS desligado. |
| 3 | Body parser JSON | middleware Express | `app.setup.ts` | Faz o parse com limite de **100 kb**; JSON inválido/grande vira erro 400/413 padronizado. |
| 4 | **Logging de requisições** | middleware Nest | `request-logger.middleware.ts` | Gera `requestId` (UUID), devolve em `X-Request-Id`, mede duração e registra 1 linha JSON no fim da resposta (método, path sem query, status, ms, IP, userId). **Nunca** loga corpo, query, headers ou tokens. Fica antes de tudo que pode rejeitar a requisição, então 401/403/429 também são logados. |
| 5 | **Sanitização** | middleware Nest | `sanitize.middleware.ts` + `sanitize.util.ts` | Remove caracteres de controle e tags HTML, `trim`, normalização Unicode (NFC), descarta chaves `__proto__`/`constructor`/`prototype`, limita profundidade. Campos `password` nunca são alterados. |
| 6 | Rate limiting | guard global | `ThrottlerGuard` | 100 req/min por IP; `POST /auth/login` limitado a **5/min**. |
| 7 | **Autenticação** | guard global | `jwt-auth.guard.ts`, `jwt.strategy.ts` | Exige JWT em **todas** as rotas, exceto as marcadas `@Public()` (*deny by default*). Valida assinatura, algoritmo, expiração, `iss` e `aud`, e recarrega o usuário no banco (conta desativada perde acesso na hora). |
| 8 | **Autorização** | guard global | `roles.guard.ts` | RBAC via `@Roles(...)`. A autorização por objeto (ex.: membro só vê o próprio cadastro) é feita nos services. |
| 9 | **Validação de entrada** | pipe global | `app.setup.ts` + DTOs | `ValidationPipe` com `whitelist` + `forbidNonWhitelisted` (propriedades extras → 400), `ParseUUIDPipe` nos parâmetros de rota. |
| 10 | Controller → Service → Prisma | — | módulos | Regras de negócio e persistência. |
| 11 | **Tratamento de erros** | filtro global | `all-exceptions.filter.ts` | Captura **toda** exceção e devolve o formato padrão abaixo. |

### Formato padrão de erro

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Dados inválidos",
  "details": [{ "field": "email", "messages": ["email must be an email"] }],
  "path": "/api/auth/login",
  "timestamp": "2026-11-20T12:00:00.000Z",
  "requestId": "0b1c2d3e-..."
}
```

| Situação | HTTP |
|---|---|
| Validação / JSON inválido | 400 |
| Sem token, token inválido/expirado, credenciais erradas | 401 |
| Papel insuficiente / acesso a objeto de outro usuário / membro inativo | 403 |
| Recurso inexistente (`P2025` do Prisma) | 404 |
| Duplicidade (`P2002`), check-in repetido, violação de FK | 409 |
| Corpo maior que o limite | 413 |
| Rate limit | 429 |
| Erro inesperado | 500 (mensagem genérica; stack só no log do servidor) |
| Banco indisponível no `/health` | 503 |

Mensagens do Prisma, SQL, stack traces e strings de conexão **nunca** chegam ao cliente. O `requestId` permite ao suporte achar o erro no log.

## 3. Persistência e migrações

PostgreSQL com Prisma. Esquema em `prisma/schema.prisma`; histórico versionado em `prisma/migrations/` (`prisma migrate deploy` aplica em produção). Entidades: `users`, `members` (1:1 com `users`), `workouts` (exercícios em `JSONB`; `member_id` nulo = treino modelo), `check_ins` (índice `member_id, checked_in_at`).

No CI, as migrações são aplicadas em um Postgres limpo e `prisma migrate diff --exit-code` garante que `schema.prisma` e as migrações não divergem.

## 4. Segurança — requisitos OWASP ASVS 5.0 atendidos

Referência: **OWASP ASVS 5.0.0 (maio de 2025)**, numeração oficial `capítulo.seção.requisito`. A coluna "Nível" indica o nível mínimo do ASVS em que o requisito é exigido (L1, L2 ou L3).

| # | Requisito ASVS 5.0.0 | Nível | O que o requisito pede | Por que faz sentido aqui | Como foi atendido (arquivos) |
|---|---|---|---|---|---|
| 1 | **V6.2.1**, **V6.2.5**, **V6.2.8**, **V6.2.9** (Authentication › Password Security) | L1 / L2 | Senha com no mínimo 8 caracteres; sem regras de composição; senha verificada exatamente como recebida; aceitar senhas de pelo menos 64 caracteres | A API guarda credenciais de alunos e funcionários | DTOs exigem 10–128 caracteres e não impõem maiúscula/número/símbolo; a sanitização **nunca** altera campos `password` (sem trim/truncamento). `create-user.dto.ts`, `create-member.dto.ts`, `sanitize.util.ts`. |
| 2 | **V6.3.1** (Authentication › General Authentication Security) | L1 | Controles contra *credential stuffing* e força bruta | `/auth/login` é o endpoint mais atacado | Rate limit de 5 tentativas/min por IP no login + bloqueio da conta por 15 min após 5 falhas consecutivas. `auth.controller.ts`, `auth.service.ts`, `auth.constants.ts`. |
| 3 | **V6.3.8** (Authentication › General Authentication Security) | L3 | Não permitir deduzir usuários válidos por mensagem, código HTTP ou tempo de resposta | Evita descobrir e-mails de alunos | Mesma mensagem e status 401 para e-mail inexistente, senha errada, conta bloqueada ou inativa; hash "isca" iguala o tempo de resposta. Não há cadastro público. Coberto por teste (`pipeline.e2e.spec.ts`). |
| 4 | **V11.4.2** (Cryptography › Hashing) | L2 | Senhas armazenadas com função de hash de senha computacionalmente cara, com parâmetros atuais | Vazamento do banco não pode expor senhas | `bcryptjs` com custo 12 e salt automático; o hash nunca é retornado (`select` explícito). `common/utils/password.ts`, `users.service.ts`. |
| 5 | **V9.1.1**, **V9.1.2**, **V9.2.1**, **V9.2.3** (Self-contained Tokens) | L1 / L2 | Validar assinatura; só algoritmos de uma *allow-list* (nunca `none`); validar `exp`/`nbf`; validar audiência (`aud`) | O JWT é a base de toda a autenticação | HS256 em *allow-list*, `ignoreExpiration: false` com `exp` de 30 min, `iss` e `aud` validados, segredo ≥ 32 caracteres exigido na inicialização. `jwt.strategy.ts`, `auth.module.ts`, `env.validation.ts`. Teste com token `alg: none`. |
| 6 | **V8.2.1**, **V8.2.2**, **V8.3.1** (Authorization) | L1 | Acesso a funções só com permissão explícita; acesso a dados por objeto (contra IDOR/BOLA); autorização aplicada no servidor | Membro não pode ver dados de outro membro | *Deny by default* (guard global + `@Public()` explícito), RBAC com `@Roles`, checagens por objeto nos services (membro só acessa o próprio cadastro, check-ins e treinos; trainer só edita os treinos que criou). Regras documentadas na tabela da §1 (atende também **V8.1.1**). Testes de 403. |
| 7 | **V2.2.1**, **V2.2.2** (Validation) e **V1.2.4** (Injection Prevention) | L1 | Validação positiva da entrada, feita na camada de serviço confiável; consultas parametrizadas/ORM contra SQL injection | Toda entrada é não confiável | DTOs com `class-validator` (tipos, tamanhos, enums, UUID, datas), `whitelist` + `forbidNonWhitelisted`, limite de 100 kb; Prisma gera consultas parametrizadas. `app.setup.ts`, `*/dto/*.ts`. |
| 8 | **V16.5.1**, **V16.5.4**, **V16.3.1**, **V16.2.5** (Security Logging and Error Handling) | L2 / L3 | Mensagem genérica em erros inesperados (sem stack, SQL, segredos); *handler* de último recurso; registrar autenticações com sucesso e falha; não registrar dados sensíveis | Evita vazar detalhes internos e permite auditoria | Filtro global `@Catch()` padroniza **toda** exceção e devolve só mensagem genérica no 500; logs JSON com `requestId`; eventos `login_success`, `login_failed`, `account_locked`; o logger nunca registra corpo, query, headers ou tokens. `all-exceptions.filter.ts`, `request-logger.middleware.ts`, `auth.service.ts`. |
| 9 | **V3.4.1**, **V3.4.2**, **V3.4.4** (Web Frontend Security › Browser Security Mechanism Headers) | L1 / L2 | Cabeçalho HSTS; CORS restrito a uma *allow-list* de origens; `X-Content-Type-Options: nosniff` | A API será consumida por um front-end no navegador | Helmet (HSTS de 1 ano, `nosniff`, remove `X-Powered-By`); CORS só para as origens da variável `CORS_ORIGINS` (vazio = desligado). `app.setup.ts`. |

**Fora de escopo, de propósito:** **V6.2.4** (checar a senha contra as ~3000 senhas mais comuns) é atendido só em parte: o validador `@IsNotCommonPassword()` usa uma lista curta. Para cumpri-lo por completo, basta trocar por uma lista maior (ex.: top 10k) ou pela API *Pwned Passwords*.

## 5. Cache

- **O que:** `GET /workouts` (listagem de treinos) — leitura frequente, mudança rara.
- **Onde/como:** `node-cache` (memória do processo) via `AppCacheService.wrap()`. Resposta traz `X-Cache: HIT|MISS`.
- **Chave:** `workouts:list:<escopo>:<hash(filtros+página)>`, onde escopo = `staff` ou `member:<id>`. Assim um membro nunca recebe resposta cacheada de outro (e a regra "membro vê só os seus + modelos" é preservada).
- **TTL:** 60 s (`CACHE_TTL_SECONDS`), com `maxKeys = 1000` (se encher, deixa de cachear em vez de falhar).
- **Invalidação explícita:** `create`, `update` e `delete` de treino chamam `invalidatePrefix('workouts:')`.
- **Limitação assumida (multi-réplica):** o cache é local a cada réplica. A invalidação explícita limpa só a réplica que recebeu a escrita; as outras ficam, no máximo, **60 s** desatualizadas (consistência eventual, aceitável para treinos). Para consistência forte, o próximo passo seria Redis compartilhado (o `AppCacheService` isola essa troca em um único arquivo).

## 6. Load balancing

- **Local (evidência reproduzível):** `docker compose up --build` sobe PostgreSQL, **2 réplicas** da API e um **nginx** (`least_conn`) na porta 8080. Com `EXPOSE_INSTANCE_ID=true` cada resposta traz `X-Instance-Id` (hostname do container):
  ```bash
  for i in $(seq 1 8); do curl -si http://localhost:8080/api/health | grep -i x-instance-id; done
  ```
  Os ids alternam entre as réplicas. Derrubar uma (`docker stop <container>`) não interrompe o serviço.
- **Produção:** Render (Blueprint `render.yaml` na raiz). O plano gratuito roda **1 instância**, por isso a evidência de balanceamento é a configuração local acima (aceita pelo enunciado). Em plano pago basta `numInstances: 2` no `render.yaml`: o proxy do Render distribui entre as instâncias e usa `/api/health` como *health check*. O `X-Instance-Id` mostra qual instância respondeu:
  ```bash
  for i in $(seq 1 10); do curl -si https://<gym-api>.onrender.com/api/health | grep -i x-instance-id; done
  ```
  (O `fly.toml` continua no repositório como alternativa de deploy na Fly.io, com `min_machines_running = 2`.)
- **Stateless:** a API não guarda sessão em memória (JWT), então qualquer réplica atende qualquer requisição. Exceções conhecidas: cache e contador de rate-limit são por réplica (o limite efetivo é ~N× em N réplicas; para limite global usar storage Redis no Throttler).
- **Migrações com réplicas:** com `RUN_MIGRATIONS=true`, cada réplica roda `prisma migrate deploy` ao subir (no Render e no compose). O Prisma usa *advisory lock* no PostgreSQL, então réplicas que sobem juntas não conflitam e a migração é aplicada uma única vez.

## 7. CI/CD

O workflow fica na **raiz do repositório** (`.github/workflows/ci-cd.yml`), porque o GitHub Actions só lê workflows nesse caminho. Ele dispara quando algo muda em `trabFinal/`, `frontend/` ou no próprio workflow.

**CI — GitHub Actions** (todo push e PR na `main`):
1. **test**: `npm ci` → `prisma validate` → migrações em Postgres limpo → checagem de drift do schema → typecheck → testes → build → `npm audit` (não bloqueante).
2. **frontend**: `npm ci` → `vite build` do painel React (`frontend/`).
3. **docker**: constrói a imagem (valida o Dockerfile).

**CD — Render (API)** (somente `main`): o Blueprint `render.yaml` cria o PostgreSQL e o serviço Docker (*Root Directory* = `trabFinal`). Com `autoDeployTrigger: checksPass`, a cada push na `main` o Render espera o workflow acima passar; só então constrói a imagem pelo `Dockerfile` e publica. Se o CI falhar, o deploy não acontece. Ao iniciar, o container aplica as migrações (`RUN_MIGRATIONS=true`) e garante o admin inicial (seed idempotente, quando `SEED_ADMIN_PASSWORD` está definida — o plano free não tem shell).

Variáveis no Render (nunca no repositório): `DATABASE_URL` (ligada ao `gym-db`), `JWT_SECRET` (gerado pelo próprio Render), `SEED_ADMIN_PASSWORD`, `CORS_ORIGINS` (URL da Vercel), `RUN_MIGRATIONS=true`, `TRUST_PROXY=1`, `EXPOSE_INSTANCE_ID=true`, `NODE_ENV=production`.

**CD — Vercel (frontend)**: projeto importado do mesmo repositório com *Root Directory* = `frontend`; publica a cada push na `main`. A variável `VITE_API_URL` aponta para a URL do Render.

## 8. Limitações conhecidas / próximos passos

- Sem refresh token / logout com revogação (tokens curtos de 30 min mitigam; a checagem de `isActive` a cada requisição permite cortar acesso imediatamente).
- Lista de senhas comuns reduzida; cache e rate limit por réplica (ver §5 e §6).
- Mensagens de validação do `class-validator` estão em inglês.
