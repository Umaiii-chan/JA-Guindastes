// Situação do resultado do backend para a cor da tela (TASK-039; ADR-017 § 3) e da cena (TASK-041,
// prop `evaluationStatus` do `CraneViewport`).
//
// Não há níveis de alerta definidos (PEND-004): a situação só compara a carga com a capacidade que o
// BACKEND devolveu, pela utilização (`carga / capacidade × 100`). Nada é calculado aqui (RN-008).
//
// - `ok`      (verde): utilização abaixo de 100 % — a carga cabe na capacidade;
// - `warning` (âmbar): utilização exatamente 100 % — carga igual à capacidade, caso ainda sem regra
//                      (P-005 em docs/known-gaps.md: se carga = capacidade é violação);
// - `over`    (vermelho): utilização acima de 100 % — carga acima da capacidade;
// - `unknown` (cinza): sem resultado, erro ou "não avaliável" (RN-007).

import type { EvaluationResult } from '../../domain/evaluation/evaluation'

export type EvaluationStatus = 'ok' | 'warning' | 'over' | 'unknown'

/** Utilização que separa "dentro" de "acima" da capacidade (100 % = carga igual à capacidade). */
export const FULL_CAPACITY_PERCENT = 100

export function evaluationStatus(result: EvaluationResult | null): EvaluationStatus {
  if (result === null || result.kind !== 'EVALUATED') return 'unknown'
  const utilization = result.utilizationPercent
  if (!Number.isFinite(utilization)) return 'unknown'
  if (utilization > FULL_CAPACITY_PERCENT) return 'over'
  if (utilization === FULL_CAPACITY_PERCENT) return 'warning'
  return 'ok'
}
