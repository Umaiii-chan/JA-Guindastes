# TASK-044 — Rotas de listagem de tabelas, tabela ativa e edição de cadastros

| Campo | Valor |
|-------|-------|
| **Status** | in-progress |
| **Prioridade** | alta |
| **Criada em** | 2026-09-26 por pessoa responsável ("pode criar as rotas que faltam", via orquestrador) |
| **Iniciada em** | 2026-09-26 |
| **Concluída em** | — |
| **Branch** | `task/TASK-044-rotas-listagem-e-edicao` |
| **PR** | — |
| **Requisitos** | pendências da TASK-042 (handoff, "rotas que faltaram" 1 a 3); RF de catálogo e de versões de tabela |
| **Regras de negócio** | ADR-016 (perfis: leitura para todos, escrita só ADMIN; CSRF), ADR-009 (tabelas no banco, uma ativa por configuração), RN-003 (ficha técnica só do cadastro), ADR-004 (camadas) |
| **Estimativa** | M |

---

## 1. Objetivo

Criar no backend as rotas que as páginas da leva D precisam, e trocar no frontend os contornos
provisórios da TASK-042 pelas rotas reais:
- listar as versões de tabela de uma configuração, com a ativa;
- editar fabricante, guindaste e configuração.

## 2. Contexto

Sem essas rotas, as telas funcionam com limitações:
- a linha do tempo de versões mostra só os ids que o navegador conhece (`localStorage`);
- o detalhe do Catálogo não sabe qual tabela está ativa;
- "Editar" grava uma cópia como item novo.

## 3. Critérios de aceite

- [ ] **CA-1** — `GET /api/v1/configurations/{id}/load-charts`, liberada para qualquer perfil
  autenticado:
  - responde `200 { "items": LoadChartSummary[], "activeLoadChartId": string | null }`, com as
    versões da mais nova para a mais antiga;
  - cada `LoadChartSummary` traz id, status, arquivo de origem, datas de importação e de ativação
    e contagens, alinhado aos campos que `GET /load-charts/{id}` já devolve, em camelCase;
  - configuração inexistente → `404`.
- [ ] **CA-2** — Edição de cadastros, só para `ADMIN` e com o cabeçalho CSRF:
  - `PATCH /api/v1/manufacturers/{id}` `{name}`;
  - `PATCH /api/v1/cranes/{id}` `{modelName}`;
  - `PATCH /api/v1/configurations/{id}` `{name?, geometry?}`;
  - as mesmas validações da criação; `404` se não existe; `409` se o nome conflita (mesma regra de
    unicidade da criação, se houver); `422` para validação;
  - mudar a ficha técnica (`geometry`) vale para as próximas avaliações, sem alterar tabelas.
- [ ] **CA-3** — Camadas e testes:
  - casos de uso e portas na aplicação, repositórios SQLAlchemy e rotas finas;
  - testes unitários com repositórios falsos, testes de API (perfil, CSRF, 404/409/422) e de
    integração com PostgreSQL (marcador `integration`);
  - nenhuma migration nova, salvo se for indispensável (justificar no handoff).
- [ ] **CA-4** — Frontend, página Tabelas:
  - a linha do tempo usa a rota nova;
  - sai o contorno `knownChartsStorage` (`localStorage`) e o campo "Acompanhar pelo id";
  - depois de importar ou ativar, a lista é relida.
- [ ] **CA-5** — Frontend, página Catálogo:
  - o detalhe da configuração mostra a tabela ativa pela rota nova;
  - "Editar" grava de verdade com `PATCH`, sem o aviso de cópia;
  - mudar a ficha técnica de uma configuração com tabela ativa pede confirmação, explicando que as
    avaliações seguintes mudam.
- [ ] **CA-6** — E2E: o spec de importação confere a linha do tempo pela rota nova, e há um spec de
  edição de cadastro. Os dois exigem backend e são pulados sem ele.
- [ ] **CA-7** — Gates do backend e do frontend e `scripts/check-structure.sh` passam.
  `docs/architecture.md` (lista de rotas) atualizado.

## 4. Escopo

### Dentro do escopo

`backend/**`, `frontend/**`, `docs/architecture.md` (só as rotas), `handoffs/TASK-044.md`.

### Fora do escopo (explicitamente — o agente NÃO faz)

- excluir cadastros ou tabelas;
- histórico de alterações e auditoria;
- ADRs e `handoffs/current.md`.

## 5. Arquivos provavelmente afetados

| Arquivo | Tipo de mudança | Verificado? |
|---------|-----------------|-------------|
| `backend/app/presentation/api/catalog.py`, `load_charts.py` / `load_chart_persistence.py` | alterar | sim |
| `backend/app/application/use_cases/*` e portas | criar/alterar | não |
| `backend/app/infrastructure/repositories/sqlalchemy_*` | alterar | sim |
| `frontend/src/infrastructure/api/*RestClient.ts` | alterar | sim |
| `frontend/src/presentation/pages/CatalogPage.tsx`, `TablesPage*` e componentes | alterar | sim |
| `frontend/src/infrastructure/storage/knownChartsStorage.ts` | remover | sim |

## 6. Riscos e dependências

- Banco e Docker não rodam localmente: a integração só é validada no CI.

## 7. Teste manual (se houver)

Seguir `docs/demo.md`: importar a v2, ver as duas versões na linha do tempo, ativar e editar o nome
de uma configuração.
