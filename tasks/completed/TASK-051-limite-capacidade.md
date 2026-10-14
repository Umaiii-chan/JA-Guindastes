# TASK-051 — Limite de capacidade por modelo

ADR-022, RN-011. Contratos: `docs/leva-e/contratos.md` §§ 3 e 4.

## Critérios de aceite
- [x] CA-1: migration com as quatro colunas e CHECKs em `cranes`.
- [x] CA-2: entidade, repositório, use cases e API do catálogo leem e editam os quatro campos.
- [x] CA-3: serviço de limite (OK/WARNING/OVER) usado por `EvaluateOperation`; REST e WS respondem `capacity_limit`.
- [x] CA-4: frontend mapeia `capacityLimit`; `evaluationStatus` usa o level; painel mostra limite, capacidade efetiva e Gauge em faixas.
- [x] CA-5: editor do guindaste no Catálogo com os quatro campos; tipos expõem `maxGroundSlopeDeg` e `maxLevelingDeg`.


## Encerramento

Mergeada pela pessoa responsável em 2026-10-14. Revisão independente (AGENTS.md § 3) dispensada por ela (autorização permanente, `handoffs/current.md` § 3, item 1).
