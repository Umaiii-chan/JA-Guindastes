// Mensagens do WebSocket de avaliação (TASK-025; doc-fonte § 15.4): espelham
// `backend/app/presentation/websocket/evaluation_messages.py`. Mudou lá, muda aqui.
//
// Diferenças em relação ao REST (TASK-024), herdadas do backend: o resultado fica em
// `payload.result` (não `status`), os motivos são só códigos (sem categoria) e o raio consultado
// se chama `queried_radius_m`.

import type { RealtimeMessage } from '../../application/evaluation/ports'
import type {
  EvaluationCapacity,
  EvaluationInput,
  EvaluationResult,
} from '../../domain/evaluation/evaluation'
import {
  ContractViolationError,
  type JsonRecord,
  readArray,
  readNullableNumber,
  readNullableRecord,
  readNullableString,
  readNumber,
  readRecord,
  readString,
} from '../shared/readJson'
import { readAccessories } from '../shared/evaluationAccessories'
import { readZoneAndWeights } from '../shared/evaluationZone'

export const EVALUATION_WEBSOCKET_PATH = '/api/v1/ws/evaluation'

export const STATE_CHANGED_TYPE = 'simulation.state.changed'
export const EVALUATED_TYPE = 'simulation.evaluated'
export const ERROR_TYPE = 'simulation.error'

/** `payload` de `simulation.state.changed`, com `configuration_id` (provisório, TASK-025 § 5). */
export interface OperationalStatePayloadDto {
  readonly configuration_id: string
  readonly boom_length_m: number
  readonly boom_angle_deg: number
  readonly turret_rotation_deg: number
  readonly cable_length_m: number
  readonly load_weight_kg: number
  /** TASK-056 (RN-014): só vai com acessórios escolhidos. */
  readonly accessory_ids?: readonly string[]
}

/** Cliente → servidor. O backend recusa campo desconhecido (`INVALID_MESSAGE`). */
export interface SimulationStateChangedMessageDto {
  readonly type: typeof STATE_CHANGED_TYPE
  readonly sequence: number
  readonly payload: OperationalStatePayloadDto
}

export interface TabulatedPointMessageDto {
  readonly boom_length_m: number
  readonly working_radius_m: number
  readonly max_capacity_kg: number
}

export interface CapacityMessageDto {
  readonly maximum_capacity_kg: number
  readonly strategy: string | null
  readonly queried_radius_m: number | null
  readonly used_point: TabulatedPointMessageDto | null
}

/** Servidor → cliente, com o mesmo `sequence` da entrada. Sem `status` (PEND-004). */
export interface SimulationEvaluatedMessageDto {
  readonly type: typeof EVALUATED_TYPE
  readonly sequence: number
  readonly payload: {
    readonly result: 'EVALUATED' | 'NOT_EVALUABLE'
    readonly geometry: { readonly working_radius_m: number; readonly hook_height_m: number } | null
    readonly capacity: CapacityMessageDto | null
    readonly utilization_percent?: number
    readonly load_chart_id: string | null
    readonly load_chart_version: string | null
    readonly reasons: readonly string[]
  }
}

/** Servidor → cliente: a mensagem não foi avaliada; a conexão continua aberta. */
export interface SimulationErrorMessageDto {
  readonly type: typeof ERROR_TYPE
  /** `null` quando o servidor não conseguiu ler o `sequence` da mensagem recusada. */
  readonly sequence: number | null
  readonly payload: {
    /** `MALFORMED_MESSAGE` | `MESSAGE_TOO_LARGE` | `UNKNOWN_MESSAGE_TYPE` | `INVALID_MESSAGE` | `INTERNAL_ERROR`. */
    readonly code: string
    readonly message: string
    readonly errors: readonly {
      readonly location: readonly (string | number)[]
      readonly message: string
      readonly error_type: string
    }[]
  }
}

export function toStateChangedMessage(
  sequence: number,
  input: EvaluationInput,
): SimulationStateChangedMessageDto {
  return {
    type: STATE_CHANGED_TYPE,
    sequence,
    payload: {
      configuration_id: input.configurationId,
      boom_length_m: input.boomLengthM,
      boom_angle_deg: input.boomAngleDeg,
      turret_rotation_deg: input.turretRotationDeg,
      cable_length_m: input.cableLengthM,
      load_weight_kg: input.loadWeightKg,
      ...(input.accessoryIds && input.accessoryIds.length > 0
        ? { accessory_ids: input.accessoryIds }
        : {}),
    },
  }
}

/** Mensagem do servidor já traduzida para a tela (porta da sessão de avaliação). */
export type ServerMessage = RealtimeMessage

/** Código usado quando o próprio servidor manda algo fora do contrato. */
export const INVALID_SERVER_MESSAGE = 'INVALID_SERVER_MESSAGE'

/** Lê um frame de texto do servidor. Nunca lança: o que não segue o contrato vira `invalid`. */
export function parseServerMessage(text: string): ServerMessage {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return invalid('Mensagem do servidor não é JSON.')
  }
  try {
    const message = readRecord(json, 'message')
    const type = readString(message, 'type', 'message')
    if (type === EVALUATED_TYPE) {
      return {
        kind: 'evaluated',
        sequence: readInteger(message, 'sequence', 'message'),
        result: mapEvaluatedPayload(readRecord(message.payload, 'message.payload')),
      }
    }
    if (type === ERROR_TYPE) {
      const sequence =
        message.sequence === null ? null : readInteger(message, 'sequence', 'message')
      const payload = readRecord(message.payload, 'message.payload')
      return {
        kind: 'error',
        sequence,
        error: {
          code: readString(payload, 'code', 'message.payload'),
          message: readString(payload, 'message', 'message.payload'),
        },
      }
    }
    return invalid(`Tipo de mensagem desconhecido: "${type}".`)
  } catch (error) {
    if (error instanceof ContractViolationError) return invalid(error.message)
    throw error
  }
}

function invalid(message: string): ServerMessage {
  return { kind: 'invalid', error: { code: INVALID_SERVER_MESSAGE, message } }
}

function readInteger(record: JsonRecord, key: string, path: string): number {
  const value = readNumber(record, key, path)
  if (!Number.isInteger(value)) throw new ContractViolationError(`${path}.${key}`, 'inteiro')
  return value
}

function mapEvaluatedPayload(payload: JsonRecord): EvaluationResult {
  const path = 'message.payload'
  const result = readString(payload, 'result', path)
  const geometry = readNullableRecord(payload, 'geometry', path)
  const capacityRecord = readNullableRecord(payload, 'capacity', path)
  const common = {
    workingRadiusM: geometry && readNumber(geometry, 'working_radius_m', `${path}.geometry`),
    hookHeightM: geometry && readNumber(geometry, 'hook_height_m', `${path}.geometry`),
    capacity: capacityRecord && mapCapacity(capacityRecord, `${path}.capacity`),
    loadChartId: readNullableString(payload, 'load_chart_id', path),
    loadChartVersion: readNullableString(payload, 'load_chart_version', path),
    ...readZoneAndWeights(payload, path),
    ...readAccessories(payload, path),
  }
  if (result === 'EVALUATED') {
    if (common.capacity === null) throw new ContractViolationError(`${path}.capacity`, 'objeto')
    return {
      kind: 'EVALUATED',
      ...common,
      capacity: common.capacity,
      utilizationPercent: readNumber(payload, 'utilization_percent', path),
    }
  }
  if (result === 'NOT_EVALUABLE') {
    const reasons = readArray(payload, 'reasons', path).map((code, index) => {
      if (typeof code !== 'string') {
        throw new ContractViolationError(`${path}.reasons[${index}]`, 'texto')
      }
      return { code, category: null }
    })
    return { kind: 'NOT_EVALUABLE', ...common, reasons }
  }
  throw new ContractViolationError(`${path}.result`, '"EVALUATED" ou "NOT_EVALUABLE"')
}

function mapCapacity(capacity: JsonRecord, path: string): EvaluationCapacity {
  const usedPoint = readNullableRecord(capacity, 'used_point', path)
  const usedPointPath = `${path}.used_point`
  return {
    maximumCapacityKg: readNumber(capacity, 'maximum_capacity_kg', path),
    strategy: readNullableString(capacity, 'strategy', path),
    queriedRadiusM: readNullableNumber(capacity, 'queried_radius_m', path),
    usedPoint: usedPoint && {
      boomLengthM: readNumber(usedPoint, 'boom_length_m', usedPointPath),
      workingRadiusM: readNumber(usedPoint, 'working_radius_m', usedPointPath),
      maxCapacityKg: readNumber(usedPoint, 'max_capacity_kg', usedPointPath),
    },
  }
}
