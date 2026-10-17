// Cor e texto da situação e do risco de tombamento, usados pelo cartão de resultado e pelo selo mínimo.

import {
  type EvaluationStatus,
  evaluationStatus,
} from '../../application/evaluation/evaluationStatus'
import type { EvaluationResult, TippingRisk } from '../../domain/evaluation/evaluation'
import type { Tone } from '../ui'

/**
 * Cor e texto de cada situação (ADR-019 § 1). Com `capacityLimit` (TASK-051; RN-011), a situação é o
 * nível que o backend devolveu (`OK`, `WARNING`, `OVER`); sem ele, só `ok` e `over`.
 */
export const STATUS_PRESENTATION: Record<EvaluationStatus, { tone: Tone; label: string }> = {
  ok: { tone: 'ok', label: 'Dentro da capacidade' },
  warning: { tone: 'warning', label: 'Perto do limite' },
  over: { tone: 'danger', label: 'Acima da capacidade' },
  unknown: { tone: 'neutral', label: 'Sem avaliação' },
}

/** Selo do risco de tombamento por regras (RN-013; TASK-055): cor e texto de cada nível. */
export const TIPPING_RISK_PRESENTATION: Record<TippingRisk, { tone: Tone; label: string }> = {
  LOW: { tone: 'ok', label: 'Risco de tombamento: baixo' },
  ATTENTION: { tone: 'warning', label: 'Risco de tombamento: atenção' },
  HIGH: { tone: 'danger', label: 'Risco de tombamento: alto' },
}

/**
 * Selo mínimo do resultado (TASK-104): a situação e o risco de tombamento, para ficarem à vista
 * quando os painéis estão ocultos. Mesmas cores e textos do cartão.
 */
export function evaluationSealItems(
  result: EvaluationResult | null,
  blocked: boolean,
): { tone: Tone; label: string }[] {
  const shown = blocked ? null : result
  const base =
    shown?.kind === 'NOT_EVALUABLE'
      ? { tone: 'neutral' as const, label: 'Não avaliável' }
      : STATUS_PRESENTATION[evaluationStatus(shown)]
  const items = [base]
  if (shown?.tippingRisk != null) items.push(TIPPING_RISK_PRESENTATION[shown.tippingRisk])
  return items
}
