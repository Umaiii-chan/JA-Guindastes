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
| **Branch** | `task/TASK-037-documentacao-final`, a partir de `d58edf6` |
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

## 3. Arquivos modificados

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

## 5. Decisões tomadas

- `docs/demo.md` é citado como código (`` `docs/demo.md` ``), sem link Markdown: o arquivo ainda não
  existe nesta base e o `check-structure.sh` falha com link quebrado. Depois do merge da TASK-035,
  virar link no `README.md` (§ "Como rodar") e no `docs/development-guide.md` § 2.
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
| 1 | Depois do merge das TASK-033..036, fazer uma passada curta nos documentos (lista no § 10) ou deixar para cada tarefa atualizar os seus? | não | | |
| 2 | Criar tarefa para remover o `app` de compatibilidade de `app/presentation/api/main.py` (apontando `tests/test_openapi.py` para `app.main`) e o `build_catalog_repository` não usado (known-gaps D-001, D-002)? | não | | |
| 3 | Confirmar o critério da coluna "Tarefas" dos requisitos (do campo "Requisitos" das tarefas concluídas, sem TASK-002 e TASK-009) | não | | |

## 9. ⚠️ Segurança

- nada a relatar

## 10. Próximo passo

**Papel:** Revisor (outra sessão/ferramenta); depois a pessoa responsável.

**O que fazer, concretamente:**
1. Revisar `git diff d58edf6...task/TASK-037-documentacao-final`, conferindo cada fato contra o
   arquivo/handoff citado (começar por `docs/architecture.md` §§ 2, 4, 5 e `docs/known-gaps.md`).
2. Depois do merge das tarefas paralelas, atualizar:
   - **TASK-033/034** (telas de catálogo e importação): `README.md` (estado; tabela de rotas se a tela
     usar outras), `docs/architecture.md` § 2 (frontend) e § 9, `docs/known-gaps.md` L-001 e L-009
     (configuração digitada em texto), `docs/requirements/functional.md` (RF-001/002/005/006/010).
   - **TASK-035** (seed, Docker, `docs/demo.md`): trocar `` `docs/demo.md` `` por link no `README.md`
     e no `docs/development-guide.md` § 2; `docs/development-guide.md` §§ 2, 3, 6 e 9 e
     `docs/architecture.md` § 7 (se o Compose passar `FILE_STORAGE_DIR`, volume, healthcheck em
     `/api/v1/health`, migrations automáticas, comando do seed); `docs/known-gaps.md` L-008.
   - **TASK-036** (e2e, divisão do pacote, CI): `docs/testing-strategy.md` §§ 2, 5 e 7 (tipo e2e,
     comando, job novo), `docs/development-guide.md` § 3 (comando e2e) e § 1 (pré-requisitos, se
     houver navegador), `docs/architecture.md` § 7 (jobs do CI), `docs/known-gaps.md` D-008 e § 6,
     `docs/guides/workflow.md` § 8 (jobs).
3. Sessão principal: registrar a TASK-037 em `handoffs/current.md` e revisar se as P-014..017 de
   `known-gaps.md` duplicam a § 7 do índice.

**Ler primeiro (nesta ordem):**
1. `AGENTS.md`
2. este handoff
3. `tasks/in-progress/TASK-037-documentacao-final.md` § 3
4. `docs/architecture.md` e `docs/known-gaps.md`

**Cuidado com:**
- O `check-structure.sh` valida links Markdown: qualquer link para `docs/demo.md` antes do merge da
  TASK-035 quebra o CI.
- "Em `d58edf6`" nos textos marca o que as tarefas paralelas podem ter mudado.

## 11. Como revisar este trabalho

- Comece por `docs/architecture.md` § 2 (composição) e § 5 (tabelas) contra `backend/app/main.py` e a
  migration `backend/alembic/versions/1f4cfaff16e8_criar_catalogo_e_tabelas_de_carga.py`.
- Tenho menos certeza sobre o resumo por tema da § 4.1 de `known-gaps.md`: os números dos itens foram
  tirados das §§ 8 dos handoffs, mas a pergunta exata só está lá.
- Docstrings: só texto; os gates do backend passaram (§ 4).
