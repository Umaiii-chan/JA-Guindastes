# TASK-004 — Registrar a toolchain e criar o esqueleto do backend com gates

| Campo | Valor |
|-------|-------|
| **Status** | in-progress |
| **Prioridade** | alta |
| **Criada em** | 2026-09-26 por Anderson Sehnem (pedido em sessão com o agente Claude Code) |
| **Iniciada em** | 2026-09-26 |
| **Concluída em** | — |
| **Branch** | `task/TASK-004-toolchain-e-esqueleto-backend` (a partir de `development` @ `17fea3f`) |
| **PR** | — |
| **Requisitos** | RNF-002, RNF-007, RNF-008 |
| **Regras de negócio** | — |
| **Estimativa** | M |

---

## 1. Objetivo

O backend passa a existir como esqueleto em Clean Architecture, com gates determinísticos iguais no
local e no CI, para que as próximas tarefas (domínio, motor de cálculo, importação) tenham onde entrar.

## 2. Contexto

Pedido da pessoa em 2026-09-26: "pode começar a desenvolver o projeto". Decisões dela em chat, no mesmo
dia: toolchain recomendada (ADR-012), autorização para alterar o `.github/workflows/ci.yml` (arquivo
protegido), dados fictícios rotulados nos testes, e mover as TASK-001..003 para `completed/`. Esta
branch também leva o commit do aceite dos ADR-004..011, decidido pela pessoa depois do merge do PR #3.

## 3. Critérios de aceite

- [ ] **CA-1** — Dado `backend/`, quando rodo `uv sync --locked`, então as dependências instalam a
  partir do `uv.lock` versionado, com Python 3.14.
- [ ] **CA-2** — Dado o esqueleto, quando rodo `uv run ruff check .`, `uv run ruff format --check .`,
  `uv run mypy app`, `uv run lint-imports` e `uv run pytest` em `backend/`, então todos terminam com exit 0.
- [ ] **CA-3** — Dado um import de `fastapi` dentro de `app/domain`, quando rodo `uv run lint-imports`,
  então o contrato "Domínio não depende de frameworks" quebra (as regras de camadas são verificadas por máquina).
- [ ] **CA-4** — Dado o backend, quando faço `GET /openapi.json`, então recebo 200 com o título da API (RNF-007).
- [ ] **CA-5** — Dado o CI, quando o PR roda, então o job "Backend" executa os mesmos comandos de
  `docs/development-guide.md` § 3 e passa.
- [ ] **CA-6** — `docs/development-guide.md` §§ 1–3 trazem os comandos reais do backend; os do frontend
  continuam "A VALIDAR" (TASK-005). O ADR-012 está no índice e em `docs/architecture.md` § 8.

## 4. Escopo

### Dentro do escopo

- ADR-012; esqueleto `backend/` (pacotes das 4 camadas, app FastAPI sem endpoints próprios, 1 teste);
  job `backend` no CI; `development-guide.md`; `.gitignore`.
- Aceite dos ADR-004..011 e movimentação das TASK-001..003 (decisões da pessoa).

### Fora do escopo (explicitamente — o agente NÃO faz)

- Qualquer entidade, regra ou endpoint de negócio (tarefas seguintes).
- Frontend (TASK-005), banco/Alembic, Docker Compose.
- Correção da concorrência do CI (ORG-10 do registro de pesquisa).

## 5. Arquivos provavelmente afetados

| Arquivo | Tipo de mudança | Verificado? |
|---------|-----------------|-------------|
| `backend/**` (pyproject, uv.lock, .python-version, app/, tests/) | criar | sim |
| `.github/workflows/ci.yml` | alterar (job `backend`; `deploy` passa a depender dele) | sim |
| `docs/decisions/ADR-012-toolchain-de-desenvolvimento.md`, índice, `docs/architecture.md`, `docs/known-gaps.md`, `docs/development-guide.md` | criar / alterar | sim |
| `docs/decisions/ADR-004..011`, `tasks/completed/TASK-001..003`, `.gitignore`, `handoffs/` | alterar / mover | sim |

## 6. Riscos e dependências

- Risco: dependência futura sem suporte a Python 3.14 → registrado no ADR-012.

## 7. Teste manual (se houver)

1. Em `backend/`: `uv run uvicorn app.presentation.api.main:app --reload` e abrir `/docs`.
   **Esperado:** página do OpenAPI com o título "Crane Simulator API".

---

## 8. Plano (preenchido pelo Planejador)

| # | Passo | Arquivos | Como verificar | Feito |
|---|-------|----------|----------------|-------|
| 1 | Commit do aceite dos ADR-004..011 | `docs/` | — | [x] |
| 2 | Esqueleto do backend e gates | `backend/` | CA-1..CA-4 | [x] |
| 3 | Job de CI | `ci.yml` | CA-5 | [x] |
| 4 | ADR-012 e docs | `docs/` | CA-6 | [x] |
| 5 | Mover TASK-001..003, handoff, commit | `tasks/`, `handoffs/` | `check-structure.sh` | [x] |

## 9. Cenários de teste (preenchido pelo Engenheiro de testes)

| Cenário | Critério | Tipo | Arquivo de teste | Status |
|---------|----------|------|------------------|--------|
| contrato OpenAPI exposto | CA-4 | integração (TestClient) | `backend/tests/test_openapi.py` | verde |
| import proibido no domínio quebra o contrato | CA-3 | manual (import-linter) | — | verificado |

## 10. Parecer da revisão (preenchido pelo Revisor)

**Resultado:** — (aguardando revisão)

## 11. Encerramento (preenchido ao mover para completed/)

- O que foi entregue (2–3 linhas):
- O que ficou de fora e virou tarefa nova: TASK-...
- Aprendizados para o template/docs:
