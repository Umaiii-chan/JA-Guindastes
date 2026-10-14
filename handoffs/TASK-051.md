# Handoff — TASK-051 — limite de capacidade por modelo

| Campo | Valor |
|-------|-------|
| **Data** | 2026-10-14 |
| **Tarefa** | `tasks/in-progress/TASK-051-limite-capacidade.md` |
| **Etapa** | implementação |
| **Branch** | `task/TASK-051-limite-capacidade` |

## O que foi feito
- Backend: `CraneLimits` (domínio), `evaluate_capacity_limit`, porta `CraneLimitsProvider`, colunas em `cranes`
  (migration `e7a3c915d2b8`), catálogo (POST/PATCH/GET de guindaste com os quatro campos), `capacity_limit` em REST e WS.
- Frontend: `capacityLimit` nos clientes, `evaluationStatus` pelo level, painel com limite/capacidade efetiva/Gauge em faixas,
  campos no Drawer do guindaste, `maxGroundSlopeDeg`/`maxLevelingDeg` em `Crane` (opcionais: backend antigo não os envia).
- Atualizei testes existentes cujo contrato mudou (resposta do guindaste, `capacity_limit: null` sem banco, OpenAPI).
- Testes novos já escritos antes da mudança de prioridade: domínio, caso de uso, API do catálogo, REST/WS, migration offline,
  mapeamento e clientes/painel/status no frontend.

## Verificações (saídas reais)
- Backend: ruff, format, mypy, lint-imports passaram; pytest passou (integração pulada sem Postgres; `test_create_admin` conhecido, ignorado).
- Frontend: lint, format:check, typecheck, `npm test` (740 passaram), build passaram. `npm run e2e`: NÃO EXECUTADO.

## Testes a escrever depois
- Drawer do guindaste (página Catálogo): criar/editar com limites, erro 422 por campo.
- `craneLimits.ts` (parse, faixas, `craneLimitChanges`) e cliente REST do catálogo com os campos de limite.
- E2E do painel com WARNING/OVER.
- Integração Postgres da migration (upgrade/downgrade, `compare_metadata`) no CI.

## Pendências
- Dependo do PR #3 (TASK-050) e do commit de contratos da leva E. Migrations da leva ficam em várias cabeças: encadear 051 → 052 → 056 → 057.
