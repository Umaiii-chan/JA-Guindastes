// Estática da operação (TASK-106; RN-017; ADR-050), igual no REST (`EvaluationResponse.stability`) e
// no WebSocket (`simulation.evaluated`.payload.stability):
//
// `stability`: `{ tipping_ratio_percent, critical_edge, tipped, pad_reactions_kg: [fl, fr, rl, rr],
// worst_pad_share, deflection_m, pad_half_span_m, wind_limit_ms, wind_force_n }` ou `null`.
//
// Ausente ou `null` (backend anterior à TASK-106, ou sem geometria): o campo `stability` fica de fora
// do resultado. O frontend só mostra o que o backend devolve (RN-008): não calcula tombamento.

import type { StabilityResult } from '../../domain/evaluation/evaluation'
import {
  ContractViolationError,
  type JsonRecord,
  readArray,
  readNullableRecord,
  readNumber,
  readString,
} from './readJson'

export function readStability(
  record: JsonRecord,
  path: string,
): { readonly stability?: StabilityResult } {
  if (!('stability' in record)) return {}
  const stability = readNullableRecord(record, 'stability', path)
  if (stability === null) return {}
  const stabilityPath = `${path}.stability`
  if (typeof stability.tipped !== 'boolean') {
    throw new ContractViolationError(`${stabilityPath}.tipped`, 'booleano')
  }
  const reactions = readArray(stability, 'pad_reactions_kg', stabilityPath)
  if (reactions.length !== 4 || reactions.some((value) => typeof value !== 'number')) {
    throw new ContractViolationError(`${stabilityPath}.pad_reactions_kg`, 'lista de 4 números')
  }
  return {
    stability: {
      tippingRatioPercent: readNumber(stability, 'tipping_ratio_percent', stabilityPath),
      criticalEdge: readString(stability, 'critical_edge', stabilityPath),
      tipped: stability.tipped,
      padReactionsKg: reactions as readonly number[],
      worstPadShare: readNumber(stability, 'worst_pad_share', stabilityPath),
      deflectionM: readNumber(stability, 'deflection_m', stabilityPath),
      padHalfSpanM: readNumber(stability, 'pad_half_span_m', stabilityPath),
      windLimitMs: readNumber(stability, 'wind_limit_ms', stabilityPath),
      windForceN: readNumber(stability, 'wind_force_n', stabilityPath),
    },
  }
}
