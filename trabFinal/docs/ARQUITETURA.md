# Gym API — Documentação de arquitetura

API RESTful para gestão de academia. **Stack:** Node.js 20 · NestJS 10 · PostgreSQL 16 · Prisma 5 · node-cache · Docker · GitHub Actions.

## 1. Visão geral

```
Cliente ──HTTPS──▶ Load balancer (nginx / proxy da Fly.io)
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

> A numeração exata dos itens (ex.: `6.2.x`) deve ser conferida no PDF oficial do ASVS 5.0.0 ao entregar; abaixo cito o **capítulo** e o texto do requisito.

| # | Capítulo ASVS 5.0 | Requisito (resumo) | Por que faz sentido aqui | Como foi atendido |
|---|---|---|---|---|
| 1 | **V6 Authentication** — senhas | Tamanho mínimo, permitir senhas longas e bloquear senhas comuns | A API guarda credenciais de alunos e funcionários | DTO: 10–128 caracteres, sem regras de composição forçada, `@IsNotCommonPassword()` (lista curta; em produção usar lista maior/HIBP). `create-user.dto.ts`, `create-member.dto.ts`, `password.validator.ts`. |
| 2 | **V6 Authentication** — anti-força-bruta | Controles contra *brute force* e *credential stuffing* | `/auth/login` é o endpoint mais atacado | Rate limit de 5 tentativas/min por IP + bloqueio da conta por 15 min após 5 falhas consecutivas. `auth.controller.ts`, `auth.service.ts`. |
| 3 | **V6 Authentication** — enumeração | Respostas de falha de autenticação não revelam se o usuário existe | Evita descobrir e-mails de alunos | Mesma mensagem/status para e-mail inexistente, senha errada, conta bloqueada ou inativa; hash "isca" iguala o tempo de resposta. Coberto por teste (`pipeline.e2e.spec.ts`). |
| 4 | **V11 Cryptography** — armazenamento de senha | Senhas guardadas com KDF aprovado, com fator de custo e salt | Vazamento do banco não pode expor senhas | `bcryptjs` com custo 12 (salt automático). `common/utils/password.ts`. Hash nunca é retornado (`select` explícito). |
| 5 | **V9 Self-contained Tokens** | Validar assinatura, algoritmo permitido, expiração, emissor e audiência | O JWT é a base de toda a autenticação | HS256 em *allow-list* (rejeita `none`), `exp` de 30 min, `iss`/`aud` validados, segredo ≥ 32 caracteres exigido na inicialização. `jwt.strategy.ts`, `auth.module.ts`, `env.validation.ts`. Teste com token `alg: none`. |
| 6 | **V8 Authorization** | Acesso por função restrito a quem tem permissão explícita + controle em nível de objeto (BOLA/IDOR) | Membro não pode ver dados de outro membro | *Deny by default* (guard global + `@Public()` explícito), RBAC com `@Roles`, e checagens por objeto nos services (membro só acessa o próprio cadastro/check-ins/treinos; trainer só edita treinos que criou). Testes de 403. |
| 7 | **V2 Validation / V1 Sanitization** | Validação positiva da estrutura e dos tipos de entrada; tratar dados antes de usá-los | Toda entrada é não confiável | DTOs com `class-validator` (tipos, tamanhos, enums, UUID, datas), `whitelist` + `forbidNonWhitelisted`, limite de 100 kb, sanitização do middleware; Prisma usa consultas parametrizadas (sem SQL injection). |
| 8 | **V16 Security Logging and Error Handling** | Erros genéricos ao cliente, sem dados sensíveis; eventos de segurança registrados | Evita vazar stack/SQL e permite auditoria | Filtro global padronizado; logs JSON estruturados com `requestId`; eventos `login_success`, `login_failed`, `account_locked` (sem senha/token). |
| 9 | **V13 Configuration** | Segredos fora do código; configuração segura | Evitar segredos no repositório | Tudo por variáveis de ambiente (`.env` no `.gitignore`), falha rápida se faltar `JWT_SECRET`/`DATABASE_URL`, Helmet, container rodando como usuário não-root. |

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
- **Produção:** Fly.io com `min_machines_running = 2` (`fly.toml`); o proxy da Fly balanceia entre as machines e usa o `/api/health` como *health check*.
- **Stateless:** a API não guarda sessão em memória (JWT), então qualquer réplica atende qualquer requisição. Exceções conhecidas: cache e contador de rate-limit são por réplica (o limite efetivo é ~N× em N réplicas; para limite global usar storage Redis no Throttler).
- **Migrações com réplicas:** rodam uma vez por deploy (`release_command` na Fly) ou, no compose, com `prisma migrate deploy` (que usa *advisory lock* — réplicas simultâneas não conflitam).

## 7. CI/CD (GitHub Actions — `.github/workflows/ci-cd.yml`)

1. **test** (PR e push): `npm ci` → `prisma validate` → migrações em Postgres limpo → checagem de drift do schema → typecheck → testes → build → `npm audit` (não bloqueante).
2. **docker**: constrói a imagem (valida o Dockerfile).
3. **deploy** (somente push em `main`): `flyctl deploy --remote-only` (o `release_command` aplica as migrações) e garante 2 réplicas.

Segredo necessário no GitHub: `FLY_API_TOKEN`.

## 8. Limitações conhecidas / próximos passos

- Sem refresh token / logout com revogação (tokens curtos de 30 min mitigam; a checagem de `isActive` a cada requisição permite cortar acesso imediatamente).
- Lista de senhas comuns reduzida; cache e rate limit por réplica (ver §5 e §6).
- Mensagens de validação do `class-validator` estão em inglês.
