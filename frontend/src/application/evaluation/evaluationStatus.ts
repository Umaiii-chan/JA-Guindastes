// Situação do resultado do backend para a cor da tela (TASK-039; ADR-017 § 3) e da cena (TASK-041,
// prop `evaluationStatus` do `CraneViewport`).
//
// Não há níveis de alerta definidos (PEND-004): a situação só compara a carga com a capacidade que o
// BACKEND devolveu, pela utilização (`peso comparado / capacidade × 100`, com peso comparado = carga +
// gancho desde a TASK-046; ADR-018). Nada é calculado aqui (RN-008).
//
// - `ok`      (verde): avaliado e dentro da capacidade (utilização até 100 %);
// - `over`    (vermelho): avaliado e acima da capacidade (utilização acima de 100 %);
// - `unknown` (cinza): sem resultado, erro ou "não avaliável" (RN-007).
//
// `warning` (âmbar) existe no tipo, para casar com a paleta da cena, mas a UI NÃO o produz: ainda não
// há critério de atenção (PEND-004). Carga igual à capacidade conta como "dentro" até a P-005
// (docs/known-gaps.md) decidir se é violação.

import type { EvaluationResult } from '../../domain/evaluation/evaluation'

export type EvaluationStatus = 'ok' | 'warning' | 'over' | 'unknown'

/** Utilização que separa "dentro" de "acima" da capacidade (100 % = carga igual à capacidade). */
export const FULL_CAPACITY_PERCENT = 100

export function evaluationStatus(result: EvaluationResult | null): EvaluationStatus {
  if (result === null || result.kind !== 'EVALUATED') return 'unknown'
  const utilization = result.utilizationPercent
  if (!Number.isFinite(utilization)) return 'unknown'
  return utilization > FULL_CAPACITY_PERCENT ? 'over' : 'ok'
}
