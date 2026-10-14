# ADR-022 — Limite de capacidade por modelo

**Status:** Proposto — **Data:** 2026-10-14 — **Tarefa:** TASK-051 — **Regra:** RN-011

## Contexto
Cada modelo de guindaste precisa de um limite de uso da capacidade da tabela e de uma faixa de atenção.

## Decisão
- Quatro colunas novas em `cranes`: `capacity_limit_percent` (1 a 100, padrão 100), `warning_band_percent`
  (1 a 100, padrão 90), `max_ground_slope_deg` (0 a 45, padrão 1,0, FICTÍCIO) e `max_leveling_deg` (0 a 45,
  padrão 3,0, FICTÍCIO), com CHECKs. O limite vale para todas as configurações do modelo.
- Serviço de domínio `evaluate_capacity_limit`: capacidade efetiva = tabela × limite; `OVER` se o peso
  comparado passa da efetiva; `WARNING` a partir da faixa de atenção (% do limite); senão `OK`. Carga igual
  à efetiva não é `OVER`.
- Porta mínima `CraneLimitsProvider` (limites do guindaste da configuração). `EvaluatedOperation` traz
  `capacity_limit`; REST e WebSocket respondem `capacity_limit` (`null` em "não avaliável").
- Frontend usa o `level` do backend para a cor; o cálculo não é refeito no cliente (RN-008).

## Consequências
Migration `e7a3c915d2b8` (down_revision `b4e1d7c93a52`). Valores de inclinação ficam FICTÍCIOS até haver dado oficial.
