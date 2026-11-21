# Changelog — Trabalho Final (Gym API)

Todas as mudanças relevantes do trabalho final de Programação para a Web II (pastas `trabFinal/` e `frontend/`).
Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/); versões seguem [SemVer](https://semver.org/lang/pt-BR/).

## [Não lançado]

_Próximos passos previstos até a entrega final (01/12/2026):_ links de produção no README, relatório em PDF, revisão da documentação.

## [1.1.0] — 2026-11-20 — Parcial 1

### Adicionado
- **Frontend** (`frontend/`): painel Vite + React com login e telas por papel:
  ADMIN (membros, treinos, check-ins, usuários), TRAINER (membros, treinos, check-ins) e MEMBER (perfil, treinos, check-in).
  A listagem de treinos exibe o header `X-Cache` (HIT/MISS) da API.
- **CI/CD** (`.github/workflows/ci-cd.yml`, na raiz): migrações em Postgres limpo, checagem de drift do schema,
  typecheck, testes, build da API, build do frontend e build da imagem Docker.
- **Deploy no Render** (`render.yaml`): Blueprint com PostgreSQL + API Docker, `JWT_SECRET` gerado pela plataforma,
  health check `/api/health` e deploy somente após o CI passar.
- **Deploy na Vercel** do frontend (`frontend/vercel.json`, variável `VITE_API_URL`).
- Seed idempotente do admin inicial no `docker-entrypoint.sh` quando `SEED_ADMIN_PASSWORD` está definida.
- Porta do nginx configurável no Docker Compose (`LB_PORT`, padrão 8080).

### Alterado
- Documentação de deploy (README e `docs/ARQUITETURA.md`): de Fly.io → Railway → **Render (API) + Vercel (frontend)**.
- Mapeamento OWASP ASVS revisado com a numeração oficial do ASVS 5.0.0.

### Removido
- Workflow duplicado em `trabFinal/.github/workflows/` (o GitHub Actions só lê workflows na raiz do repositório).

## [1.0.0] — 2026-11-20

### Adicionado
- API RESTful em **NestJS 10 + PostgreSQL 16 + Prisma 5** para gestão de academia.
- **Autenticação JWT** com três papéis (`ADMIN`, `TRAINER`, `MEMBER`) e autorização por função e por objeto
  (membro só acessa o próprio perfil, treinos e check-ins).
- Recursos: usuários da equipe, membros, treinos (individuais e modelo) e check-ins, com paginação e filtros.
- **Pipeline de middlewares**: helmet → CORS → body parser (100 kb) → request ID + logging → sanitização →
  rate limit → autenticação → autorização → validação (DTOs) → controller → filtro global de exceções.
- **Respostas de erro padronizadas** (`statusCode`, `error`, `message`, `details`, `path`, `timestamp`, `requestId`),
  sem stack traces ou detalhes do banco para o cliente.
- **Persistência** com migração versionada (`prisma/migrations`) e seed de demonstração.
- **Segurança (OWASP ASVS 5.0.0)**: política de senha + bloqueio de senhas comuns, bcrypt, bloqueio de conta após
  falhas, rate limit no login, resposta anti-enumeração, JWT com segredo ≥ 32 caracteres e expiração curta,
  queries via ORM, cabeçalhos de segurança e CORS restrito.
- **Cache** da listagem de treinos (node-cache, TTL 60 s + invalidação explícita em create/update/delete).
- **Load balancing**: Docker Compose com 2 réplicas da API atrás de nginx (`least_conn`) e header `X-Instance-Id`.
- Dockerfile multi-stage (usuário não-root, healthcheck), `fly.toml` alternativo, Swagger em `/docs`.
- Testes (Jest): sanitização, filtro de exceções, cache e pipeline HTTP ponta a ponta (25 testes).

[Não lançado]: https://github.com/Rogers-Rocha/Pweb2/compare/b3224f8...HEAD
[1.1.0]: https://github.com/Rogers-Rocha/Pweb2/compare/0b03fbe...b3224f8
[1.0.0]: https://github.com/Rogers-Rocha/Pweb2/commit/0b03fbe
