# TASK-011 — Criar a infraestrutura mínima de persistência com PostgreSQL

| Campo | Valor |
|-------|-------|
| **Status** | completed |
| **Prioridade** | alta |
| **Criada em** | 2026-09-26 por Anderson Sehnem (leva TASK-010..013, definida em chat) |
| **Iniciada em** | 2026-09-26 |
| **Concluída em** | 2026-09-26 |
| **Branch** | `task/TASK-011-persistencia-postgresql` (a partir de `ae2ec66`, o commit que abriu a leva TASK-010..013) |
| **PR** | [#15](https://github.com/Umaiii-chan/JA-Guindastes/pull/15), mergeado em 2026-09-26 com CI verde |
| **Requisitos** | RNF-002 (domínio sem SQLAlchemy); doc-fonte §§ 19 e 22.1 |
| **Regras de negócio** | — |
| **Estimativa** | M |

---

## 1. Objetivo

O projeto passa a ter um PostgreSQL local via Docker Compose e a infraestrutura de persistência do
backend (configuração por `DATABASE_URL`, engine e sessão do SQLAlchemy, `Base` declarativa e
Alembic), **sem tabelas de negócio**: elas entram com cada caso de uso.

## 2. Contexto

ADR-007 (PostgreSQL), ADR-012 (Alembic para migrations), ADR-004 (Clean Architecture: só a
infraestrutura importa SQLAlchemy). A doc-fonte cita SQLAlchemy na camada de infraestrutura (§ 8.4)
e o Docker Compose com `postgres` no ambiente local (§ 22.1). Escolhas da pessoa responsável em chat
(2026-09-26): SQLAlchemy 2.x, Alembic e driver psycopg 3 com wheels binários; versão do PostgreSQL
fixada numa tag major existente; sem alterar `.github/workflows/` (o CI ainda não terá banco).
Tarefa paralela às TASK-010, 012 e 013 (sem arquivos em comum); handoff próprio em
`handoffs/TASK-011.md` (regra da TASK-006).

## 3. Critérios de aceite

- [ ] **CA-1** — Dado o `.env` da raiz com `POSTGRES_*` preenchidas, quando rodo `docker compose up -d`
  na raiz, então o serviço `postgres` (imagem com tag major fixada) sobe com os dados num volume
  nomeado e a porta publicada só em `127.0.0.1`; sem as variáveis, o Compose falha com mensagem que
  aponta o `.env.example`.
- [ ] **CA-2** — Dado um ambiente sem `DATABASE_URL` (ou com valor vazio, inválido ou de outro
  driver), quando a configuração do banco é carregada, então ocorre `DatabaseConfigurationError` com
  mensagem clara que cita `DATABASE_URL` e não expõe a senha.
- [ ] **CA-3** — Dada uma `DATABASE_URL` válida, quando crio o engine e a fábrica de sessões, então
  nenhuma conexão com o banco é aberta.
- [ ] **CA-4** — Dado o Alembic em `backend/`, quando rodo `uv run alembic upgrade head --sql`, então
  ele usa a `DATABASE_URL` e a `Base.metadata`; sem `DATABASE_URL`, falha com "FAILED" e mensagem
  clara. Não há revisão de negócio.
- [ ] **CA-5** — Dado o banco local no ar e `DATABASE_URL` exportada, quando rodo
  `uv run alembic upgrade head` e `uv run pytest -m integration`, então ambos passam (`SELECT 1` pelo
  engine e pela sessão); sem banco, os testes de integração são pulados.
- [ ] **CA-6** — Domínio e aplicação continuam sem importar `sqlalchemy`: `uv run lint-imports` passa,
  assim como `uv sync --locked`, `uv run ruff check .`, `uv run ruff format --check .`,
  `uv run mypy app` e `uv run pytest`.
- [ ] **CA-7** — `.env.example` lista as variáveis novas sem valores; nenhum segredo versionado;
  `bash scripts/check-structure.sh` passa.
- [ ] **CA-8** — `docs/development-guide.md` traz o pré-requisito Docker, os comandos reais do banco e
  do Alembic, as variáveis e, na § 9, a linha do `lint-imports >/dev/null` no Windows;
  `docs/architecture.md` §§ 5 e 7 refletem o ambiente local.

## 4. Escopo

### Dentro do escopo

- `docker-compose.yml` (só o serviço `postgres`), `.env.example`;
- dependências `sqlalchemy`, `alembic`, `psycopg[binary]` (`backend/pyproject.toml`, `backend/uv.lock`);
- `backend/app/infrastructure/database/` (`config.py`, `engine.py`, `base.py`);
- `backend/alembic.ini` e `backend/alembic/` (sem revisões);
- testes em `backend/tests/infrastructure/database/`;
- `docs/development-guide.md`, `docs/architecture.md` §§ 5 e 7.

### Fora do escopo (explicitamente — o agente NÃO faz)

- modelos ORM, tabelas, repositórios e revisões do Alembic de negócio;
- serviço de banco no CI (`.github/workflows/` não muda nesta tarefa);
- conteinerizar backend e frontend;
- arquivos das tarefas paralelas: `backend/app/application`, `backend/app/infrastructure/importers`,
  `backend/tests/{application,infrastructure/importers,fixtures}`, `docs/known-gaps.md` (TASK-010),
  `README.md` (TASK-012), `frontend/` (TASK-013); e `handoffs/current.md`.
- Se algo daqui parecer necessário, registrar em "Pendências" e parar, não implementar.

## 5. Arquivos provavelmente afetados

| Arquivo | Tipo de mudança | Verificado? |
|---------|-----------------|-------------|
| `docker-compose.yml`, `.env.example` | criar / alterar | sim |
| `backend/pyproject.toml`, `backend/uv.lock` | alterar | sim |
| `backend/app/infrastructure/database/{config,engine,base}.py` | criar | sim |
| `backend/alembic.ini`, `backend/alembic/{env.py,script.py.mako,versions/.gitkeep}` | criar | sim |
| `backend/tests/infrastructure/__init__.py`, `backend/tests/infrastructure/database/*` | criar | sim |
| `docs/development-guide.md`, `docs/architecture.md` | alterar | sim |
| `tasks/in-progress/TASK-011-persistencia-postgresql.md`, `handoffs/TASK-011.md` | criar | sim |

## 6. Riscos e dependências

- Risco: alguma dependência sem suporte a Python 3.14 → verificado: `uv.lock` tem wheels `cp314`
  (Windows e Linux) de SQLAlchemy e psycopg-binary; Alembic é Python puro.
- Risco: conflito com a TASK-010 em `backend/tests/infrastructure/__init__.py` (vazio nas duas) e, se
  ela adicionar dependências, em `backend/pyproject.toml`/`backend/uv.lock` → resolver no merge
  (regerar o lock com `uv lock`).
- Depende de Docker com virtualização para o CA-1 e o CA-5 (ver handoff).

## 7. Teste manual (se houver)

1. Na raiz: `cp .env.example .env` e preencher `POSTGRES_*` e `DATABASE_URL` com valores locais.
2. `docker compose up -d` e `docker compose ps`.
   **Esperado:** serviço `postgres` com estado `healthy`.
3. Em `backend/`: `set -a && source ../.env && set +a`, depois `uv run alembic upgrade head` e
   `uv run pytest -m integration -rs`.
   **Esperado:** Alembic sem erro; `2 passed`, nenhum `skipped`.
4. Na raiz: `docker compose down` (sem `-v`).

---

## 8. Plano (preenchido pelo Planejador)

| # | Passo | Arquivos | Como verificar | Feito |
|---|-------|----------|----------------|-------|
| 1 | Conferir a tag do PostgreSQL e escrever o Compose e o `.env.example` | `docker-compose.yml`, `.env.example` | `docker manifest inspect`; `docker compose config` | [x] |
| 2 | `uv add` das dependências e conferir wheels para 3.14 | `pyproject.toml`, `uv.lock` | `uv sync --locked` | [x] |
| 3 | Configuração, engine/sessão e `Base` | `app/infrastructure/database/` | CA-2, CA-3 | [x] |
| 4 | Alembic lendo `DATABASE_URL` e `Base.metadata` | `alembic.ini`, `alembic/` | CA-4 | [x] |
| 5 | Testes sem banco e de integração (pulados sem banco) | `tests/infrastructure/database/` | `uv run pytest` | [x] |
| 6 | Subir o banco, `alembic upgrade head`, `SELECT 1`, derrubar | — | CA-1, CA-5 | [ ] NÃO EXECUTADO (ver handoff) |
| 7 | Documentação | `development-guide.md`, `architecture.md` | CA-8 | [x] |

**Análise de impacto:**
- Arquivos que podem quebrar indiretamente: nenhum código existente importa a infraestrutura de banco.
- Regras de negócio aplicáveis: nenhuma.
- Decisões necessárias: ver handoff § 8.

## 9. Cenários de teste (preenchido pelo Engenheiro de testes)

| Cenário | Critério | Tipo | Arquivo de teste | Status |
|---------|----------|------|------------------|--------|
| sem `DATABASE_URL` (ausente, vazia, só espaços) → erro claro | CA-2 | unitário | `backend/tests/infrastructure/database/test_config.py` | verde |
| URL inválida ou de outro driver → erro sem a senha | CA-2 | unitário | idem | verde |
| `repr` da configuração não mostra a senha | CA-2 | unitário | idem | verde |
| URL válida cria engine e sessão sem conectar | CA-3 | unitário | `backend/tests/infrastructure/database/test_engine.py` | verde |
| `Base.metadata` com convenção de nomes | — | unitário | idem | verde |
| Alembic offline usa `DATABASE_URL`; sem ela, "FAILED" | CA-4 | unitário (subprocesso) | `backend/tests/infrastructure/database/test_alembic_env.py` | verde |
| `SELECT 1` pelo engine e pela sessão | CA-5 | integração (pulado sem banco) | `backend/tests/infrastructure/database/test_postgres_integration.py` | pulado (sem banco) |

## 10. Parecer da revisão (preenchido pelo Revisor)

**Resultado:** — (aguardando revisão)

## 11. Encerramento (preenchido ao mover para completed/)

> Movida para `completed/` em 2026-09-26 pela autorização permanente da pessoa responsável (revisão independente dispensada). A verificação com banco real ficou NÃO EXECUTADA (virtualização desativada na máquina).

- O que foi entregue (2–3 linhas):
- O que ficou de fora e virou tarefa nova: TASK-...
- Aprendizados para o template/docs:
