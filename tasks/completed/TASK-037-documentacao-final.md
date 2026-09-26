# TASK-037 — Consolidar a documentação no estado real do projeto

| Campo | Valor |
|-------|-------|
| **Status** | completed |
| **Prioridade** | média |
| **Criada em** | 2026-09-26 por Anderson Sehnem (pedido em chat, leva C) |
| **Iniciada em** | 2026-09-26 |
| **Concluída em** | — |
| **Branch** | `task/TASK-037-documentacao-final` (a partir de `d58edf6`, commit-base da leva C) |
| **PR** | — |
| **Requisitos** | RNF-011 |
| **Regras de negócio** | — (nenhuma regra nova; `docs/business-rules.md` não é tocado) |
| **Estimativa** | M |

---

## 1. Objetivo

Quem abrir o repositório encontra README e documentos de `docs/` descrevendo o que existe em
`development` @ `d58edf6` (leva A e B mergeadas): como rodar com e sem Docker, rotas, arquitetura,
modelo de dados, testes, segurança, lacunas e rastreabilidade dos requisitos.

## 2. Contexto

As tarefas das levas A e B (TASK-022..032) não podiam editar `docs/` nem o `README.md` e deixaram, na
§ 10 dos handoffs, a lista do que precisava mudar. `docs/testing-strategy.md` e `docs/security.md`
ainda eram o template, com `<preencher>`. Esta tarefa roda em paralelo com a TASK-033/034 (frontend),
TASK-035 (seed, Docker, `docs/demo.md`) e TASK-036 (e2e, Vite, CI) e não toca os arquivos delas.

## 3. Critérios de aceite

- [ ] **CA-1** — Dado o `README.md`, quando alguém o lê, então encontra o estado atual, como rodar sem Docker (`uv run uvicorn app.main:app --reload`, migrations, `FILE_STORAGE_DIR`) e com Docker (`docker compose up -d --build`), as rotas principais e a menção ao roteiro de demonstração `docs/demo.md`.
- [ ] **CA-2** — `docs/architecture.md` descreve status, componentes reais do backend e do frontend, a raiz de composição, o fluxo real de avaliação (REST e WebSocket com `sequence`), as tabelas da migration, integrações, ambientes (Compose e CI) e, na § 8, os ADR-001..015 com o status do índice.
- [ ] **CA-3** — `docs/development-guide.md` lista os comandos reais (backend, frontend, banco, Alembic, Docker), as variáveis (`DATABASE_URL`, `FILE_STORAGE_DIR`, `POSTGRES_*`, `BACKEND_PORT` etc.), a estrutura de pastas real e a solução de problemas acumulada nos handoffs.
- [ ] **CA-4** — `docs/testing-strategy.md` e `docs/security.md` não têm mais `<preencher>`: descrevem pytest, marcador `integration` + `REQUIRE_INTEGRATION_DB`, Vitest, gates do CI, limites provisórios de upload (P-008), ausência de autenticação (P-009) e segredos; o que não existe está como PENDENTE ou A VALIDAR.
- [ ] **CA-5** — `docs/known-gaps.md` tem L-00x, P-00x e §§ 5–6 no estado real, com as pendências abertas dos handoffs (sem respostas inventadas).
- [ ] **CA-6** — `docs/requirements/functional.md` e `non-functional.md` têm a coluna "Tarefas" preenchida, sem mudar o texto nem o status `Proposto`.
- [ ] **CA-7** — Docstrings desatualizadas apontadas nos handoffs corrigidas (só texto), com os gates do backend verdes.
- [ ] **CA-8** — `bash scripts/check-structure.sh` passa (links internos válidos).
- [ ] **CA-9** — Dada a leva C mesclada na branch (`f9d2f35`), quando alguém lê README, arquitetura, guia, testes, segurança, lacunas e requisitos, então encontra as telas de catálogo, importação e carga (TASK-033/034), o link para `docs/demo.md`, o volume e o healthcheck do Compose e o seed `python -m app.demo_seed` (TASK-035), o E2E com Playwright e o job `e2e` com `E2E_SEED_*` (TASK-036), e a D-008 em "Resolvidos".

## 4. Escopo

### Dentro do escopo

- `README.md`, `docs/architecture.md`, `docs/development-guide.md`, `docs/testing-strategy.md`,
  `docs/security.md`, `docs/known-gaps.md`, `docs/project-overview.md`, `docs/requirements/*.md`,
  `docs/guides/workflow.md` e trechos desatualizados de outros guias;
- docstrings desatualizadas apontadas nos handoffs (só texto).

### Fora do escopo (explicitamente — o agente NÃO faz)

- `handoffs/current.md` (a sessão principal atualiza o índice), `docs/business-rules.md`
  (protegido), ADRs aceitos, `docs/demo.md` (TASK-035);
- arquivos das tarefas paralelas: `frontend/src/`, seed, `docker-compose.yml`, Dockerfiles,
  `vite.config.ts`, e2e, `.github/workflows/`;
- qualquer mudança de comportamento do código.

## 5. Arquivos provavelmente afetados

| Arquivo | Tipo de mudança | Verificado? |
|---------|-----------------|-------------|
| `README.md` | alterar | sim |
| `docs/architecture.md`, `docs/development-guide.md`, `docs/testing-strategy.md`, `docs/security.md`, `docs/known-gaps.md`, `docs/project-overview.md` | alterar | sim |
| `docs/requirements/functional.md`, `docs/requirements/non-functional.md` | alterar (coluna "Tarefas") | sim |
| `docs/guides/workflow.md`, `docs/guides/using-ai-tools.md`, `docs/guides/git-github.md` | alterar (protocolo de tarefas paralelas) | sim |
| `backend/app/main.py`, `backend/app/presentation/api/main.py`, `backend/app/domain/services/load_chart_interpolator.py`, `backend/app/domain/value_objects/capacity_query.py`, `backend/tests/fixtures/load_chart_csv/README.md` | alterar (só texto) | sim |

## 6. Riscos e dependências

- Risco: documentar algo que a TASK-033..036 muda em paralelo → mitigação: descrever `d58edf6` e
  registrar no handoff o que revisar depois do merge delas.
- Risco: link para `docs/demo.md`, que ainda não existia em `d58edf6`, quebrar o `check-structure.sh`
  → mitigação: citado como código na primeira parte; virou link depois da mescla da leva C.

## 7. Teste manual (se houver)

1. Ler o `README.md` e seguir "Como rodar" numa máquina com Docker.
   **Esperado:** a stack sobe e as rotas citadas aparecem em `/docs` (com as ressalvas do texto).

---

## 8. Plano (preenchido pelo Planejador)

| # | Passo | Arquivos | Como verificar | Feito |
|---|-------|----------|----------------|-------|
| 1 | Ler §§ 2, 7, 8 e 10 dos handoffs TASK-011..032 e conferir fatos no código | — | — | [x] |
| 2 | Reescrever README, arquitetura e guia de desenvolvimento | `README.md`, `docs/architecture.md`, `docs/development-guide.md` | `check-structure.sh` | [x] |
| 3 | Preencher testes, segurança, lacunas, visão geral, requisitos, guias | `docs/*.md`, `docs/requirements/*.md`, `docs/guides/*.md` | `grep '<preencher>'`; `check-structure.sh` | [x] |
| 4 | Corrigir docstrings | `backend/app/...` | gates do backend | [x] |
| 5 | Tarefa, handoff, commits | `tasks/in-progress/`, `handoffs/TASK-037.md` | `git log` | [x] |
| 6 | Segunda parte: documentar a leva C mesclada (`f9d2f35`), pedido da sessão principal | `README.md`, `docs/*.md`, `docs/requirements/*.md`, `docs/guides/workflow.md` | `check-structure.sh` | [x] |

**Análise de impacto:**
- Arquivos que podem quebrar indiretamente: nenhum (só texto; docstrings não mudam comportamento).
- Regras de negócio aplicáveis: nenhuma.
- Decisões necessárias: nenhuma nova; pendências existentes consolidadas em `docs/known-gaps.md`.

## 9. Cenários de teste (preenchido pelo Engenheiro de testes)

| Cenário | Critério | Tipo | Arquivo de teste | Status |
|---------|----------|------|------------------|--------|
| links internos válidos e sem `<preencher>` no contexto mínimo | CA-8 | estrutura | `scripts/check-structure.sh` | verde |
| docstrings não quebram lint, formatação, tipos, camadas nem testes | CA-7 | gates | comando único do backend | verde |

## 10. Parecer da revisão (preenchido pelo Revisor)

**Resultado:** — (não revisado)

## 11. Encerramento (preenchido ao mover para completed/)

- O que foi entregue (2–3 linhas):
- O que ficou de fora e virou tarefa nova: TASK-...
- Aprendizados para o template/docs:

> Movida para `completed/` em 2026-09-26 pela autorização permanente da pessoa responsável (revisão independente dispensada).
