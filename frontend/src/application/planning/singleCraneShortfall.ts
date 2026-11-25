// Quando um guindaste sozinho não atende a operação (TASK-120; ADR-053, Proposto): decide se a tela
// deve recomendar o içamento com dois guindastes. Função pura sobre o resultado da avaliação do
// backend; nenhuma capacidade é calculada aqui (RN-008). O cálculo do tandem em si é a RN-016.

import type { EvaluationResult } from '../../domain/evaluation/evaluation'

/** Por que um guindaste só não atende. */
export type ShortfallKind =
  /** Peso comparado acima da capacidade efetiva (RN-011): utilização do limite passa de 100 %. */
  | 'over-capacity'
  /** A tabela não tem capacidade para o ponto: lança ou raio além do tabelado. */
  | 'outside-chart'

export interface SingleCraneShortfall {
  readonly kind: ShortfallKind
  /** Texto curto, para a pessoa, do que falta. */
  readonly message: string
}

/**
 * Motivos de "não avaliável" em que mais capacidade ou outro posicionamento podem resolver: o ponto
 * está além da tabela (`CapacityUnsupportedReason`). Ficam de fora os que dois guindastes não
 * resolvem: sem ficha técnica, sem tabela ativa, acessório inexistente, geometria impossível e
 * estado fora das faixas da ficha (ângulo, lança e cabo que a pessoa pode ajustar).
 */
export const CHART_SHORTFALL_REASON_CODES: readonly string[] = [
  'POINT_NOT_IN_CHART',
  'BOOM_LENGTH_ABOVE_CHART_MAX',
  'RADIUS_ABOVE_CHART_MAX',
]

/** Utilização do limite acima da qual um guindaste só não atende (RN-011: 100 % do limite). */
export const OVER_CAPACITY_LIMIT_PERCENT = 100

/** Devolve o motivo de um guindaste só não atender, ou `null` se atende ou se dois não ajudam. */
export function singleCraneShortfall(result: EvaluationResult | null): SingleCraneShortfall | null {
  if (result === null) return null
  if (result.kind === 'NOT_EVALUABLE') {
    const beyondChart = result.reasons.some((reason) =>
      CHART_SHORTFALL_REASON_CODES.includes(reason.code),
    )
    return beyondChart
      ? {
          kind: 'outside-chart',
          message: 'A carga ou o raio passa do que a tabela deste guindaste atende.',
        }
      : null
  }
  const utilization = result.capacityLimit?.limitUtilizationPercent ?? result.utilizationPercent
  return utilization > OVER_CAPACITY_LIMIT_PERCENT
    ? {
        kind: 'over-capacity',
        message: 'A carga passa da capacidade deste guindaste nesta posição.',
      }
    : null
}
