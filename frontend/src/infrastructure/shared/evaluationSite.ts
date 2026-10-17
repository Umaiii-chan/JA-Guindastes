// Campos da rede elétrica e do içamento crítico da avaliação (TASK-107; ADR-051), iguais no REST
// (`EvaluationResponse`) e no WebSocket (`simulation.evaluated`.payload):
//
// - `power_lines`: lista de `{ line_id, label, voltage_kv, required_m, distance_m, swept_distance_m,
//   status, swept_status, nearest_part }`;
// - `critical_lift`: `{ is_critical, triggers: [{ code, message }], plan_items }` ou `null`.
//
// Ausentes ou `null` (backend anterior à TASK-107, ou pedido sem `site`) não entram no resultado;
// `power_lines: []` entra como lista vazia.

import type {
  CriticalLift,
  PowerLineClearance,
  PowerLineClearanceStatus,
} from '../../domain/evaluation/evaluation'
import {
  ContractViolationError,
  type JsonRecord,
  readArray,
  readNumber,
  readRecord,
  readString,
} from './readJson'

const STATUSES: readonly string[] = ['OK', 'ATTENTION', 'VIOLATION']
const PARTS: readonly string[] = ['boom', 'cable', 'load']

export interface EvaluationSite {
  readonly powerLines: readonly PowerLineClearance[]
  readonly criticalLift: CriticalLift | null
}

function readStatus(record: JsonRecord, key: string, path: string): PowerLineClearanceStatus {
  const value = readString(record, key, path)
  if (!STATUSES.includes(value)) {
    throw new ContractViolationError(`${path}.${key}`, '"OK", "ATTENTION" ou "VIOLATION"')
  }
  return value as PowerLineClearanceStatus
}

function readClearance(item: unknown, path: string): PowerLineClearance {
  const record = readRecord(item, path)
  const part = readString(record, 'nearest_part', path)
  if (!PARTS.includes(part)) {
    throw new ContractViolationError(`${path}.nearest_part`, '"boom", "cable" ou "load"')
  }
  return {
    lineId: readString(record, 'line_id', path),
    label: readString(record, 'label', path),
    voltageKv: readNumber(record, 'voltage_kv', path),
    requiredM: readNumber(record, 'required_m', path),
    distanceM: readNumber(record, 'distance_m', path),
    sweptDistanceM: readNumber(record, 'swept_distance_m', path),
    status: readStatus(record, 'status', path),
    sweptStatus: readStatus(record, 'swept_status', path),
    nearestPart: part as PowerLineClearance['nearestPart'],
  }
}

function readCriticalLift(json: unknown, path: string): CriticalLift {
  const record = readRecord(json, path)
  if (typeof record.is_critical !== 'boolean') {
    throw new ContractViolationError(`${path}.is_critical`, 'booleano')
  }
  return {
    isCritical: record.is_critical,
    triggers: readArray(record, 'triggers', path).map((item, index) => {
      const triggerPath = `${path}.triggers[${index}]`
      const trigger = readRecord(item, triggerPath)
      return {
        code: readString(trigger, 'code', triggerPath),
        message: readString(trigger, 'message', triggerPath),
      }
    }),
    planItems: readArray(record, 'plan_items', path).map((item, index) => {
      if (typeof item !== 'string') {
        throw new ContractViolationError(`${path}.plan_items[${index}]`, 'texto')
      }
      return item
    }),
  }
}

export function readSite(record: JsonRecord, path: string): Partial<EvaluationSite> {
  const present = (value: unknown) => value !== undefined && value !== null
  return {
    // Só os campos que vieram: sem `site` no pedido, o resultado fica como era antes da TASK-107.
    ...(present(record.power_lines)
      ? {
          powerLines: readArray(record, 'power_lines', path).map((item, index) =>
            readClearance(item, `${path}.power_lines[${index}]`),
          ),
        }
      : {}),
    ...(present(record.critical_lift)
      ? { criticalLift: readCriticalLift(record.critical_lift, `${path}.critical_lift`) }
      : {}),
  }
}
