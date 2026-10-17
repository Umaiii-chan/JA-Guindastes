# TASK-096 — lança entre colunas: próxima mais longa na interpolação

Decisão da pessoa responsável em 2026-10-16 (decisão D2 da auditoria AUD-01): "pode usar a lança
mais longa entre colunas". Registrada no ADR-043, que substitui o ADR-030 quanto ao comprimento.

## Critérios de aceite

- [x] **CA-1** — Com o comprimento de lança entre duas colunas (ou abaixo da menor), a
  `LinearInterpolationLookup` usa a coluna da próxima lança mais longa e não interpola o
  comprimento; a capacidade nunca passa da coluna mais longa.
- [x] **CA-2** — Dentro da coluna escolhida, o raio continua interpolado linearmente; raio fora da
  coluna continua "não suportado" (RN-007); acima da maior coluna, `BOOM_LENGTH_ABOVE_CHART_MAX`.
- [x] **CA-3** — A estratégia ganha testes próprios, que falham com a regra antiga.
- [x] **CA-4** — ADR-043, índice dos ADRs e `docs/demo.md` atualizados.


## Encerramento

Mergeada pela pessoa responsável em 2026-10-17 (PR #43). Revisão independente (AGENTS.md § 3) dispensada por ela (autorização permanente, `handoffs/current.md` § 3, item 1).
