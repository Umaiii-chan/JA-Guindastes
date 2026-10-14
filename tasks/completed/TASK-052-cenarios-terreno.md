# TASK-052 — Cenários com terreno editável e obstáculos

ADR: ADR-023. Depende do PR #3 (TASK-050) e do commit de contratos da leva E.

## Critérios de aceite

- CA-1: entidade `Scenario`, repositório SQLAlchemy e migration (`down_revision = b4e1d7c93a52`).
- CA-2: rotas `/api/v1/scenarios`; logados listam e abrem; só autor ou admin edita e apaga.
- CA-3: cena com terreno deslocado por `terrainHeightAt`, obstáculos de caixa e cilindro, guindaste
  assentado e posicionado; `setScenario` aditivo no handle e prop no `CraneViewport`.
- CA-4: seção "Ambiente" com inclinação, feições, obstáculos, posição, salvar, abrir e apagar.
- CA-5: `groundSlopeDeg` com sapatas FICTÍCIAS enviado como `ground_slope_deg` (REST e WS); backend
  aceita (>= 0).
- CA-6: gates existentes verdes (sem testes novos por decisão de prioridade; ver handoff).


## Encerramento

Mergeada pela pessoa responsável em 2026-10-14. Revisão independente (AGENTS.md § 3) dispensada por ela (autorização permanente, `handoffs/current.md` § 3, item 1).
