# Handoff — TASK-037 — implementação

> **Tarefas em paralelo (TASK-006):** este handoff fica em `handoffs/TASK-037.md` e não edita
> `handoffs/current.md` (índice geral, atualizado pela sessão principal).

| Campo | Valor |
|-------|-------|
| **Data/hora** | 2026-09-26 (UTC-3, Brasília) |
| **Tarefa** | `tasks/in-progress/TASK-037-documentacao-final.md` |
| **Etapa concluída** | implementação |
| **Papel exercido** | Planejador + Implementador (mesma sessão; revisão independente não feita) |
| **Ferramenta/agente** | Claude Code (Opus 5.5), agente em segundo plano num worktree isolado |
| **Branch** | `task/TASK-037-documentacao-final`, a partir de `d58edf6`; leva C mesclada em `f9d2f35` (segunda parte) |
| **Duração aproximada** | 1 h 30 min |

---

## 1. Objetivo desta etapa

Consolidar README e `docs/` no estado real de `development` @ `d58edf6` (leva A e B mergeadas).

## 2. O que foi feito

- Criei a branch com `git switch -c task/TASK-037-documentacao-final d58edf6`; `git log -1` →
  `d58edf6 chore(tasks): mover TASK-029 a 032 para completed e abrir a leva C`.
- Li as §§ 2, 7, 8 e 10 dos handoffs TASK-011..032, `handoffs/current.md`, o índice de ADRs e os
  documentos a atualizar. Conferi no código só fatos pontuais: `backend/app/main.py`,
  `app/load_chart_persistence_composition.py`, rotas (`grep` nos routers), a migration
  `1f4cfaff16e8`, `.env.example`, `docker-compose.yml`, `.github/workflows/ci.yml`, `vite.config.ts`,
  `nginx.conf.template`, Dockerfiles, `pyproject.toml` (marcador `integration`, contratos do
  import-linter), `package.json`, árvore de `backend/app` e `frontend/src`.
- `README.md`: estado atual, stack, estrutura com `assets/` e Dockerfiles, como rodar com Docker
  (`docker compose up -d --build`, migrations no container) e sem Docker (`docker compose up -d
  postgres`, `uv run uvicorn app.main:app --reload`, `FILE_STORAGE_DIR`), modo sem `DATABASE_URL`,
  tabela de rotas com a condição de cada uma, menção a `docs/demo.md` como "roteiro de demonstração"
  (sem link, ver § 5), até 15 tarefas em paralelo.
- `docs/architecture.md`: reescrito — status; componentes reais do backend (domínio, portas, casos
  de uso, infraestrutura com banco/repositórios/storage/importadores, apresentação REST e WebSocket,
  raiz de composição e as duas composições) e do frontend (domínio, aplicação, infraestrutura REST/WS,
  apresentação, composição, `three/`); camadas com os três contratos do import-linter; fluxo real de
  avaliação (Mermaid com WebSocket, `sequence`, debounce, fallback REST, categorias de motivo) e da
  importação/ativação; modelo de dados com as 5 tabelas da migration e restrições; integrações;
  ambientes (Compose, local sem Docker, CI com os 4 jobs); § 8 com ADR-001..015 e status conferidos
  no índice (ADR-014 Proposto, ADR-015 Aceito provisório); § 9.
- `docs/development-guide.md`: status; § 2 com as duas formas de instalação; § 3 com
  `app.main:app`, saúde, testes de WebSocket, regeneração do GLB, comandos do Compose (stack, só o
  banco, migrations no container, logs), migration existente, integração com `REQUIRE_INTEGRATION_DB`;
  § 4 estrutura real; § 6 todas as variáveis (`DATABASE_URL`, `FILE_STORAGE_DIR`, `POSTGRES_*`,
  `BACKEND_PORT`, `FRONTEND_PORT`, `BACKEND_DATABASE_URL`, `API_UPSTREAM`, `REQUIRE_INTEGRATION_DB`,
  `UPDATE_EXAMPLE_GLB`); § 9 com 8 linhas novas tiradas dos handoffs (TASK-019, 027, 029, 031, 032).
- `docs/testing-strategy.md` e `docs/security.md`: sem `<preencher>`; o que não existe está como
  PENDENTE ou A VALIDAR (cobertura, auditoria, responsável por segurança, rotação de segredos, canal
  de incidentes).
- `docs/known-gaps.md`: L-001..005 reescritas; L-006..010 novas (catálogo, ciclo de vida da tabela,
  Docker, tela, banco fora do ar); dívidas D-001..008; P-001..009 atualizadas; P-014..017 novas; § 4.1
  com as perguntas abertas por tema e handoff; §§ 5 e 6. Nada movido para "Resolvidos" (só a pessoa).
- `docs/project-overview.md` § 6 (banco e infra) e glossário (raio e comprimento com a convenção
  provisória do ADR-013).
- `docs/requirements/functional.md` e `non-functional.md`: coluna "Tarefas" preenchida a partir do
  campo "Requisitos" de cada `tasks/completed/*.md` (critério explicado no cabeçalho de cada arquivo);
  texto e status `Proposto` intactos.
- Guias: `workflow.md` (handoff por tarefa, até 15 em paralelo, encerramento com o handoff da tarefa,
  jobs do CI), `using-ai-tools.md` e `git-github.md` (incluir `handoffs/TASK-NNN.md`).
- Docstrings (só texto): `load_chart_interpolator.py` e `capacity_query.py` citam a
  `ConservativeTabulatedLookup`/ADR-015 (pendência 3 da TASK-020); `presentation/api/main.py` não diz
  mais que README e guia apontam para o `app` antigo; `app/main.py` não diz mais que as rotas do
  catálogo dependem de `build_catalog_repository`. `backend/tests/fixtures/load_chart_csv/README.md`:
  coluna "Usado em" (pendência da TASK-019 § 10), conferida com `grep`.

### 2.1 Segunda parte — leva C (TASK-033..036)

A sessão principal mesclou a leva C na branch (`f9d2f35`, merge de
`task/TASK-033-telas-catalogo-e-selecao`, PR #34) e pediu os itens da § 10. Conferi no código:
`docker-compose.yml`, `backend/Dockerfile`, `.env.example`, `.github/workflows/ci.yml` (job `e2e`),
`frontend/package.json`, `vite.config.ts`, `frontend/e2e/`, `backend/app/demo_seed.py`,
`frontend/src/app/App.tsx` e `craneSetup.ts`, e as §§ 2, 7 e 8 de `handoffs/TASK-033..036.md`.

- `README.md`: estado com a leva C; frontend (seleção, cadastro, importação/ativação, carga, limites
  da ficha) e infra (volume, seed, job E2E); link para [`docs/demo.md`](../docs/demo.md); comandos
  com o seed; `FILE_STORAGE_DIR` fixo no container.
- `docs/architecture.md`: status; seed na tabela do backend e na § 3; frontend (domínio `catalog/`,
  aplicação `catalog/`, `loadChart/`, `load/`, clientes REST do catálogo e de tabelas, painéis,
  `craneSetup.ts`, `CraneSetup`, divisão do pacote); § 7 (volume, healthcheck em `/api/v1/health`,
  migrations + seed, job `e2e` com `E2E_SEED_*`); § 9.
- `docs/development-guide.md`: status; § 2 com link para `demo.md`, seed nas duas formas e
  `FILE_STORAGE_DIR` do container; § 3 (typecheck com `tsc -p e2e`, build dividido, Playwright:
  instalar, rodar local e contra a stack, relatório; migrations + seed; seed sem Docker; `down
  --volumes`); § 4 (`e2e/`, pastas novas, `demo_seed.py`); § 6 (`FILE_STORAGE_DIR`, `E2E_*`); § 9 com
  6 linhas novas (seed, catálogo 404/502, Chromium, testes pulados).
- `docs/testing-strategy.md`: Playwright; linhas de E2E sem e com backend e do seed; job `e2e` na § 5;
  dados do E2E na § 6; § 7.
- `docs/known-gaps.md`: L-001, L-005, L-008 e L-009 reescritas; D-001/D-002 sem a menção aos
  docstrings (corrigidos na primeira parte); D-009 nova (`EvaluationInputPanel.tsx` não é importado
  por nenhum módulo, verificado com `grep`); D-010 nova (cena sem carregamento sob demanda);
  **D-008 movida para "Resolvidos"** (TASK-036), a pedido da sessão principal; § 4.1 com as
  pendências das TASK-033..036; §§ 5 e 6.
- Requisitos: TASK-033 em RF-001/002/005/010; TASK-034 em RF-006/007/008/011 e RNF-006 (do campo
  "Requisitos" das tarefas; TASK-035/036 não citam RF/RNF).
- `docs/security.md` (status, volume do arquivo-fonte, credenciais dos jobs) e
  `docs/guides/workflow.md` § 8 (cinco jobs).

## 3. Arquivos modificados

Segunda parte (`git diff --stat f9d2f35 HEAD`, antes do commit deste handoff):

```text
 README.md                           | 35 ++++++++--------
 docs/architecture.md                | 43 +++++++++++--------
 docs/development-guide.md           | 82 ++++++++++++++++++++++++-------------
 docs/guides/workflow.md             |  5 ++-
 docs/known-gaps.md                  | 41 +++++++++++--------
 docs/requirements/functional.md     | 21 +++++-----
 docs/requirements/non-functional.md |  7 ++--
 docs/security.md                    |  8 ++--
 docs/testing-strategy.md            | 25 ++++++-----
 9 files changed, 159 insertions(+), 108 deletions(-)
```

Primeira parte:

```text
$ git diff --stat d58edf6...HEAD   (antes do commit da tarefa e deste handoff)
 README.md                                          | 112 +++++++---
 .../app/domain/services/load_chart_interpolator.py |   7 +-
 backend/app/domain/value_objects/capacity_query.py |   3 +-
 backend/app/main.py                                |   3 +-
 backend/app/presentation/api/main.py               |   6 +-
 backend/tests/fixtures/load_chart_csv/README.md    |   4 +-
 docs/architecture.md                               | 240 +++++++++++++--------
 docs/development-guide.md                          | 137 ++++++++----
 docs/guides/git-github.md                          |   2 +-
 docs/guides/using-ai-tools.md                      |   7 +-
 docs/guides/workflow.md                            |  29 ++-
 docs/known-gaps.md                                 |  89 ++++++--
 docs/project-overview.md                           |  10 +-
 docs/requirements/functional.md                    |  44 ++--
 docs/requirements/non-functional.md                |  26 ++-
 docs/security.md                                   |  71 +++---
 docs/testing-strategy.md                           |  96 ++++++---
 17 files changed, 599 insertions(+), 287 deletions(-)
```

Mais `tasks/in-progress/TASK-037-documentacao-final.md` e este handoff (novos).

Fora do escopo: nenhum. `docs/guides/using-ai-tools.md` e `git-github.md` entram como "outros guias
desatualizados" (permitidos pela tarefa). Não toquei `handoffs/current.md`, `docs/business-rules.md`,
ADRs, `docs/demo.md` nem arquivos das TASK-033..036.

## 4. Comandos executados e resultados

| Comando | Resultado | Saída (resumo) |
|---------|-----------|----------------|
| `bash scripts/check-structure.sh` | ✅ passou | `OK: 0 erros, 0 aviso(s)`; "nenhum link interno quebrado"; sem `<preencher>` no contexto mínimo |
| `uv run ruff check .` (backend) | ✅ passou | `All checks passed!` |
| `uv run ruff format --check .` | ✅ passou | `148 files already formatted` |
| `uv run mypy app` | ✅ passou | `Success: no issues found in 86 source files` |
| `PYTHONIOENCODING=utf-8 uv run lint-imports` | ✅ passou | `Contracts: 3 kept, 0 broken.` |
| `uv run pytest` | ✅ passou | `808 passed, 30 skipped in 15.15s` (os pulados são os de integração, sem banco local) |
| gates do frontend | ⚠️ NÃO EXECUTADO | nenhum arquivo do frontend foi alterado |
| `bash scripts/check-structure.sh` (segunda parte, depois da leva C) | ✅ passou | `OK: 0 erros, 1 aviso(s)`; o aviso é "há 5 tarefas em tasks/in-progress/" (TASK-033..037, vindas da mescla); "nenhum link interno quebrado" |
| gates do backend (segunda parte) | ⚠️ NÃO EXECUTADO | só texto em `docs/` e `README.md`; nenhum docstring tocado |

## 5. Decisões tomadas

- Primeira parte: `docs/demo.md` foi citado como código, sem link, porque não existia em `d58edf6`.
  Na segunda parte, com a leva C mesclada, virou link no `README.md` e no `docs/development-guide.md`.
- Segunda parte: D-008 foi para "Resolvidos" por pedido explícito da sessão principal
  (`known-gaps.md` diz que só a pessoa remove itens); registrei isso na própria linha.
- A documentação descreve `d58edf6`. Onde as tarefas paralelas vão mudar algo (Docker, e2e, telas),
  o texto diz "em `d58edf6`" e aponta a tarefa, sem antecipar o resultado.
- Coluna "Tarefas" dos requisitos derivada do campo "Requisitos" das tarefas concluídas, sem TASK-002
  (registro) e TASK-009 (ADR). RF-019 ficou "—" apesar de a TASK-032 citar "RF-015..020", porque ela
  não tem alerta (registrado na célula).
- Registrei como dívida D-002 que `build_catalog_repository` (`backend/app/main.py`) não é usado pela
  composição, só pelos testes (verificado com `grep`), em vez de remover o código (fora do escopo:
  só texto).
- Novas P-014..017 em `known-gaps.md` só repetem pendências já abertas em `handoffs/current.md` § 7 e
  nos handoffs (ADR-014/LGPL, auditoria, licença, regras de ativação); nenhuma resposta inventada.

## 6. Regras de negócio aplicadas

- nenhuma (documentação); `docs/business-rules.md` não foi alterado.

## 7. O que NÃO foi feito e por quê

- `handoffs/current.md` não foi editado (instrução da tarefa): a sessão principal registra a TASK-037
  e as novas entradas de `known-gaps.md`.
- "Testes relacionados" em `docs/business-rules.md` (TASK-015, 020, 025, 028): arquivo protegido.
- Remover o `app` de compatibilidade (D-001) e o `build_catalog_repository` não usado (D-002):
  mudança de código, fora do escopo.
- Diagramas de `docs/produto/diagrams/`: congelados; a arquitetura avisa que mostram o planejado.
- Revisão independente: NÃO EXECUTADA.

## 8. Pendências / decisões necessárias (para a pessoa responsável)

| # | Pergunta | Bloqueia? | Resposta | Respondida em |
|---|----------|-----------|----------|---------------|
| 1 | ~~Depois do merge das TASK-033..036, fazer uma passada curta nos documentos?~~ Feito na segunda parte, a pedido da sessão principal | — | passada feita | 2026-09-26 |
| 4 | Criar tarefa para remover `EvaluationInputPanel.tsx`, que não é importado por nenhum módulo desde a mescla da leva C (known-gaps D-009)? | não | | |
| 2 | Criar tarefa para remover o `app` de compatibilidade de `app/presentation/api/main.py` (apontando `tests/test_openapi.py` para `app.main`) e o `build_catalog_repository` não usado (known-gaps D-001, D-002)? | não | | |
| 3 | Confirmar o critério da coluna "Tarefas" dos requisitos (do campo "Requisitos" das tarefas concluídas, sem TASK-002 e TASK-009) | não | | |

## 9. ⚠️ Segurança

- nada a relatar

## 10. Próximo passo

**Papel:** Revisor (outra sessão/ferramenta); depois a pessoa responsável.

**O que fazer, concretamente:**
1. Revisar a documentação da branch conferindo cada fato contra o arquivo/handoff citado: a primeira
   parte em `git diff d58edf6...58d3f2c`, a segunda em `git diff f9d2f35...task/TASK-037-documentacao-final`
   (começar por `docs/architecture.md` §§ 2, 4, 5 e 7 e `docs/known-gaps.md`).
2. Sessão principal: registrar a TASK-037 em `handoffs/current.md` e revisar se as P-014..017 de
   `known-gaps.md` duplicam a § 7 do índice.
3. Quando o job `e2e` rodar pela primeira vez no CI, conferir se os comandos e as variáveis documentados
   (`docs/development-guide.md` §§ 3 e 6, `docs/testing-strategy.md` § 2) batem com o que passou.

**Ler primeiro (nesta ordem):**
1. `AGENTS.md`
2. este handoff
3. `tasks/in-progress/TASK-037-documentacao-final.md` § 3
4. `docs/architecture.md` e `docs/known-gaps.md`

**Cuidado com:**
- A branch já contém a leva C (`f9d2f35`): o PR desta tarefa leva também o diff das TASK-033..036, se
  o PR #34 não tiver sido mesclado antes em `development`.
- O `check-structure.sh` avisa "5 tarefas em in-progress" enquanto as TASK-033..036 não forem para
  `completed/`.

## 11. Como revisar este trabalho

- Comece por `docs/architecture.md` § 2 (composição) e § 5 (tabelas) contra `backend/app/main.py` e a
  migration `backend/alembic/versions/1f4cfaff16e8_criar_catalogo_e_tabelas_de_carga.py`.
- Tenho menos certeza sobre o resumo por tema da § 4.1 de `known-gaps.md`: os números dos itens foram
  tirados das §§ 8 dos handoffs, mas a pergunta exata só está lá.
- Docstrings: só texto; os gates do backend passaram (§ 4).
