# Handoff — TASK-004 — implementação (toolchain e esqueleto do backend)

> Handoff anterior (TASK-003) arquivado em `handoffs/history/2026-09-26-TASK-003-implementacao.md`.

| Campo | Valor |
|-------|-------|
| **Data/hora** | 2026-09-26 14:27 (UTC-3, Brasília) |
| **Tarefa** | `tasks/in-progress/TASK-004-toolchain-e-esqueleto-backend.md` |
| **Etapa concluída** | planejamento + testes + implementação |
| **Papel exercido** | Planejador, Engenheiro de testes e Implementador (um único agente, declarado conforme AGENTS.md § 3) |
| **Ferramenta/agente** | Claude Code 2.1.280 (modelo Opus 5.5), app desktop |
| **Branch** | `task/TASK-004-toolchain-e-esqueleto-backend`, a partir de `development` @ `17fea3f` |
| **Duração aproximada** | ~30 min |

---

## 1. Objetivo desta etapa

Registrar a toolchain e criar o esqueleto do backend com gates locais e de CI.

## 2. O que foi feito

- Commit do aceite dos ADR-004..011 (decisão da pessoa em chat, depois do merge do PR #3).
- Criei o ADR-012 (`Aceito`), com a toolchain escolhida pela pessoa em chat: Python 3.14 + uv, ruff,
  mypy strict, pytest, import-linter, Alembic; Node 24 + npm, Vite, Three.js puro, Vitest, ESLint,
  Prettier. Também registra os dados fictícios rotulados nos testes.
- Criei `backend/`:
  - `pyproject.toml` com as ferramentas e 3 contratos do import-linter (camadas; domínio sem
    frameworks; aplicação sem framework web/ORM);
  - `uv.lock` e `.python-version` (3.14);
  - os pacotes das 4 camadas vazios (`domain`, `application`, `infrastructure`, `presentation`);
  - a app FastAPI em `app/presentation/api/main.py`, sem endpoints próprios;
  - `tests/test_openapi.py` (RNF-007).
- Adicionei o job `backend` ao `.github/workflows/ci.yml` (autorizado pela pessoa em chat), e o
  `deploy` passou a depender dele.
- Preenchi `docs/development-guide.md` §§ 1–3 com os comandos reais do backend. Atualizei o índice de
  ADRs, `docs/architecture.md` § 8, `docs/known-gaps.md` (P-007, parte respondida) e o `.gitignore`.
- Movi TASK-001, TASK-002 e TASK-003 para `tasks/completed/` (decisão da pessoa em chat), registrando
  em cada uma que a revisão independente foi dispensada por ela.

## 3. Arquivos modificados

`git status --short` antes do commit (resumido): `backend/**` (novo), `.github/workflows/ci.yml`,
`.gitignore`, `docs/decisions/ADR-012-*` (novo), `docs/decisions/README.md`, `docs/architecture.md`,
`docs/development-guide.md`, `docs/known-gaps.md`, `tasks/` (3 movidas + TASK-004 nova), `handoffs/`.
Fora do escopo: nenhum.

## 4. Comandos executados e resultados

| Comando (em `backend/`) | Resultado | Saída (resumo) |
|---------|-----------|----------------|
| `uv lock` / `uv sync --locked` | ✅ | `Using CPython 3.14.7`; 40 pacotes resolvidos |
| `uv run ruff check .` | ✅ | `All checks passed!` |
| `uv run ruff format --check .` | ✅ | `20 files already formatted` |
| `uv run mypy app` | ✅ | `Success: no issues found in 18 source files` |
| `uv run lint-imports` | ✅ | `Contracts: 3 kept, 0 broken.` |
| `uv run lint-imports` com `import fastapi` temporário em `app/domain/__init__.py` | ✅ (esperado quebrar) | `Domínio não depende de frameworks (RNF-002) BROKEN` / `2 kept, 1 broken`; import removido depois |
| `uv run pytest` | ✅ | `1 passed` (sem avisos depois de trocar `httpx` por `httpx2`, como a Starlette recomenda) |
| validação do YAML do CI (`yaml.safe_load`) | ✅ | jobs: `structure`, `backend`, `quality`, `deploy` |
| `bash scripts/check-structure.sh` | ver o commit | rodado antes do commit |

## 5. Decisões tomadas

- Decisões da pessoa em chat (2026-09-26): toolchain do ADR-012; **autorização para alterar
  `.github/workflows/ci.yml`** (arquivo protegido); dados fictícios rotulados FICTÍCIO só em testes;
  mover TASK-001..003 para `completed/` dispensando a revisão independente.
- Sem endpoint de saúde: não há requisito para isso. O teste verifica o contrato OpenAPI (RNF-007).
- O `setup-uv` do CI usa `@v10` (última release consultada: v10.2.0), no mesmo estilo de versão
  maior do `actions/checkout@v4`.
- O job `quality` (placeholder do template) ficou como está; ele vira o job do frontend na TASK-005.

## 6. Regras de negócio aplicadas

- nenhuma

## 7. O que NÃO foi feito e por quê

- Frontend: TASK-005.
- Banco, Alembic e Docker Compose: entram com a primeira tarefa de persistência.
- Correção da concorrência do CI (ORG-10): fora do escopo.
- Nenhuma revisão cética nem independente, para poupar cota.

## 8. Pendências / decisões necessárias (para a pessoa responsável)

| # | Pergunta | Bloqueia? | Resposta | Respondida em |
|---|----------|-----------|----------|---------------|
| 1 | Apagar as branches `task/TASK-001..003` (remotas e locais) | não | | |
| 2 | Versão mais nova da doc-fonte (P-013) · onde fica o orquestrador (P-010) · dados oficiais podem ir ao repositório e a agentes de IA (P-007) | não | | |
| 3 | Convenções geométricas (P-001..P-003): bloqueiam o `GeometryService`. Proposta: ADR provisório com convenções explícitas até a empresa responder | sim, para a geometria | | |

## 9. ⚠️ Segurança

- nada a relatar

## 10. Próximo passo

**Papel:** Revisor, depois Pessoa responsável; em seguida Implementador da TASK-005

**O que fazer, concretamente:**
1. Revisar o PR (CAs da TASK-004) e fazer o merge com **squash**.
2. TASK-005: esqueleto do frontend (Vite + React + TypeScript + Three.js puro) com gates (ESLint,
   Prettier, `tsc`, Vitest, build) no job `quality`.
3. Depois: núcleo de domínio da tabela de carga (value objects, `LoadChart`/`LoadChartPoint`, porta
   `LoadChartInterpolator`, consulta fora do domínio), com testes usando dados FICTÍCIOS.

**Ler primeiro:**
1. `AGENTS.md`
2. este handoff
3. `docs/decisions/ADR-012-toolchain-de-desenvolvimento.md`
4. `docs/development-guide.md` § 3

**Cuidado com:**
- No Windows, rode os comandos do backend de dentro de `backend/`, com `uv run`.
- Os contratos do import-linter estão em `backend/pyproject.toml`. Violar um é decisão de ADR.

## 11. Como revisar este trabalho

- Comece por `backend/pyproject.toml` (ferramentas e contratos) e pelo job `backend` do `ci.yml`.
- `uv.lock` é gerado: não precisa revisar linha a linha.
