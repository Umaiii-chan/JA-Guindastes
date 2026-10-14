// Limite de capacidade do modelo (TASK-051; RN-011; ADR-022), igual no REST (`EvaluationResponse`) e
// no WebSocket (`simulation.evaluated`.payload):
//
// `capacity_limit`: `{ limit_percent, effective_capacity_kg, limit_utilization_percent,
// warning_band_percent, level: "OK" | "WARNING" | "OVER" }` ou `null`.
//
// Ausente ou `null` (backend anterior à TASK-051, ou "não avaliável"): o campo `capacityLimit` fica
// de fora do resultado, e a tela cai na utilização contra a capacidade da tabela.

import type { CapacityLimitResult, CapacityStatusLevel } from '../../domain/evaluation/evaluation'
import {
  ContractViolationError,
  type JsonRecord,
  readNullableRecord,
  readNumber,
  readString,
} from './readJson'

const LEVELS: readonly string[] = ['OK', 'WARNING', 'OVER']

export function readCapacityLimit(
  record: JsonRecord,
  path: string,
): { readonly capacityLimit?: CapacityLimitResult } {
  if (!('capacity_limit' in record)) return {}
  const limit = readNullableRecord(record, 'capacity_limit', path)
  if (limit === null) return {}
  const limitPath = `${path}.capacity_limit`
  const level = readString(limit, 'level', limitPath)
  if (!LEVELS.includes(level)) {
    throw new ContractViolationError(`${limitPath}.level`, '"OK", "WARNING" ou "OVER"')
  }
  return {
    capacityLimit: {
      limitPercent: readNumber(limit, 'limit_percent', limitPath),
      effectiveCapacityKg: readNumber(limit, 'effective_capacity_kg', limitPath),
      limitUtilizationPercent: readNumber(limit, 'limit_utilization_percent', limitPath),
      warningBandPercent: readNumber(limit, 'warning_band_percent', limitPath),
      level: level as CapacityStatusLevel,
      // Fatores do ambiente (TASK-067; RN-015); ausentes num backend anterior.
      ...(typeof limit.slope_factor === 'number' && { slopeFactor: limit.slope_factor }),
      ...(typeof limit.wind_factor === 'number' && { windFactor: limit.wind_factor }),
    },
  }
}
