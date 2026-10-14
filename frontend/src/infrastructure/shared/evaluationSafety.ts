// Campos de segurança da avaliação (TASK-055; RN-013), iguais no REST (`EvaluationResponse`) e no
// WebSocket (`simulation.evaluated`.payload):
//
// - `tipping_risk`: `"LOW" | "ATTENTION" | "HIGH" | null`;
// - `alerts`: lista de `{ code, severity, message }`.
//
// Ausentes (backend anterior à TASK-055) viram `null` e lista vazia, sem inventar valor.

import type {
  SafetyAlert,
  SafetyAlertSeverity,
  TippingRisk,
} from '../../domain/evaluation/evaluation'
import {
  ContractViolationError,
  type JsonRecord,
  readArray,
  readRecord,
  readString,
} from './readJson'

const RISKS: readonly string[] = ['LOW', 'ATTENTION', 'HIGH']
const SEVERITIES: readonly string[] = ['INFO', 'ATTENTION', 'CRITICAL']

export interface EvaluationSafety {
  readonly tippingRisk: TippingRisk | null
  readonly alerts: readonly SafetyAlert[]
}

export function readSafety(record: JsonRecord, path: string): EvaluationSafety {
  const risk = record.tipping_risk
  if (risk !== undefined && risk !== null && !(typeof risk === 'string' && RISKS.includes(risk))) {
    throw new ContractViolationError(`${path}.tipping_risk`, '"LOW", "ATTENTION", "HIGH" ou nulo')
  }
  const alerts =
    record.alerts === undefined
      ? []
      : readArray(record, 'alerts', path).map((item, index): SafetyAlert => {
          const alertPath = `${path}.alerts[${index}]`
          const alert = readRecord(item, alertPath)
          const severity = readString(alert, 'severity', alertPath)
          if (!SEVERITIES.includes(severity)) {
            throw new ContractViolationError(
              `${alertPath}.severity`,
              '"INFO", "ATTENTION" ou "CRITICAL"',
            )
          }
          return {
            code: readString(alert, 'code', alertPath),
            severity: severity as SafetyAlertSeverity,
            message: readString(alert, 'message', alertPath),
          }
        })
  return { tippingRisk: (risk ?? null) as TippingRisk | null, alerts }
}
