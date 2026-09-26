# TASK-027 — Conteinerizar backend e frontend e subir a stack completa no Docker Compose

| Campo | Valor |
|-------|-------|
| **Status** | completed |
| **Prioridade** | média |
| **Criada em** | 2026-09-26 por Anderson Sehnem (leva A, pedido em sessão com o agente Claude Code) |
| **Iniciada em** | 2026-09-26 |
| **Concluída em** | 2026-09-26 |
| **Branch** | `task/TASK-027-docker-stack-completa` (a partir de `a5b1ab0`, commit-base da leva A / TASK-021) |
| **PR** | [#27](https://github.com/Umaiii-chan/JA-Guindastes/pull/27), mergeado em 2026-09-26 |
| **Requisitos** | doc-fonte v0.1 § 22.1 (Docker Compose com frontend, backend e postgres) |
| **Regras de negócio** | — (infraestrutura; nenhuma regra funcional) |
| **Estimativa** | M |

---

## 1. Objetivo

Subir o ambiente de desenvolvimento completo (postgres + backend + frontend) com um único
`docker compose up`, como pede a doc-fonte § 22.1, e ter no CI a garantia de que as imagens constroem.

## 2. Contexto

A TASK-011 criou o `docker-compose.yml` só com o PostgreSQL. A API completa é `app.main:app`
(TASK-019). Toolchain no ADR-012 (Python 3.14 + uv; Node 24 + npm + Vite). Na máquina de
desenvolvimento o Docker não sobe (virtualização desativada; pendência 6 de `handoffs/current.md`),
então o build e a subida da stack só podem ser verificados no CI. A pessoa autorizou alterar o
`ci.yml` para gates (autorização permanente 3), com um job novo e sem mexer nos existentes.

## 3. Critérios de aceite

- [ ] **CA-1** — Dado o repositório, quando se roda `docker build backend`, então sai uma imagem com Python 3.14 e as dependências do `uv.lock` (`uv sync --locked --no-dev`), rodando como usuário não-root e servindo `uvicorn app.main:app` na porta 8000; `alembic upgrade head` pode ser rodado no container por comando documentado.
- [ ] **CA-2** — Dado o repositório, quando se roda `docker build frontend`, então sai uma imagem multi-stage (Node 24, `npm ci` + `npm run build`) com um servidor estático sem root servindo `dist/` numa porta documentada, e `/api/` encaminhado ao backend (proxy reverso).
- [ ] **CA-3** — `docker-compose.yml` tem os serviços `postgres`, `backend` e `frontend`, com `depends_on` condicionado a healthcheck, variáveis vindas do `.env` (nenhum segredo commitado) e todas as portas publicadas só em `127.0.0.1`; `docker compose config` valida.
- [ ] **CA-4** — O CI tem um job novo ("Imagens Docker") que valida o compose, constrói as duas imagens sem push e sobe a stack num teste de fumaça; os jobs existentes não mudam.
- [ ] **CA-5** — `bash scripts/check-structure.sh` passa e o YAML do CI é válido.

## 4. Escopo

### Dentro do escopo

- `docker-compose.yml`, `backend/Dockerfile`, `frontend/Dockerfile`, `backend/.dockerignore`,
  `frontend/.dockerignore`, `frontend/nginx.conf.template`, job novo no `.github/workflows/ci.yml`,
  variáveis **novas** em `.env.example`; esta tarefa e `handoffs/TASK-027.md`.

### Fora do escopo (explicitamente — o agente NÃO faz)

- Código de `backend/app` e `frontend/src`, `pyproject.toml`/`uv.lock` (TASK-023), `package.json`,
  `vite.config.ts`.
- `handoffs/current.md`, `README.md` e `docs/*.md` (mudanças listadas no § 10 do handoff).
- Rota de saúde no backend, push de imagens, deploy.

## 5. Arquivos provavelmente afetados

| Arquivo | Tipo de mudança | Verificado? |
|---------|-----------------|-------------|
| `docker-compose.yml` | alterar | sim |
| `backend/Dockerfile`, `backend/.dockerignore` | criar | sim |
| `frontend/Dockerfile`, `frontend/.dockerignore`, `frontend/nginx.conf.template` | criar | sim |
| `.github/workflows/ci.yml` | alterar (job novo `docker`) | sim |
| `.env.example` | alterar (só variáveis novas) | sim |

## 6. Riscos e dependências

- Depende da TASK-021 (commit-base `a5b1ab0`).
- Risco: build nunca executado localmente → mitigação: job de CI com build e teste de fumaça.
- Risco: TASK-023 muda `uv.lock` → a imagem usa o que estiver travado; nada a ajustar aqui.

## 7. Teste manual (se houver)

1. `cp .env.example .env` e preencher `POSTGRES_*`.
2. `docker compose up -d --build` e `docker compose ps`.
   **Esperado:** os três serviços `healthy`; `http://127.0.0.1:8080/` mostra a cena; `http://127.0.0.1:8000/docs` mostra a API.
3. `docker compose run --rm backend alembic upgrade head`.
   **Esperado:** termina com código 0.
