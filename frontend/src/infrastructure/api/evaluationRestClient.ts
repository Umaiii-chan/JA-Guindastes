// Cliente REST da avaliação: `POST /api/v1/evaluations` (TASK-024; ADR-010).

import type {
  EvaluationCapacity,
  EvaluationInput,
  EvaluationReason,
  EvaluationResult,
} from '../../domain/evaluation/evaluation'
import {
  ContractViolationError,
  type JsonRecord,
  isRecord,
  readArray,
  readNullableNumber,
  readNullableRecord,
  readNullableString,
  readNumber,
  readRecord,
  readString,
} from '../shared/readJson'
import { createApiFetch } from './apiFetch'
import { EVALUATIONS_PATH, toEvaluationRequestDto } from './evaluationContract'

/** Códigos de erro do lado do cliente (os do backend chegam como vieram). */
export const CLIENT_ERROR_CODES = {
  network: 'NETWORK_ERROR',
  invalidRequest: 'INVALID_REQUEST',
  http: 'HTTP_ERROR',
  invalidResponse: 'INVALID_RESPONSE',
} as const

/** Falha ao avaliar por REST; `code` e `message` vão para a tela (`EvaluationError`). */
export class EvaluationClientError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'EvaluationClientError'
    this.code = code
  }
}

export interface EvaluationRestClient {
  evaluate(input: EvaluationInput): Promise<EvaluationResult>
}

export interface EvaluationRestClientOptions {
  /** `fetch` injetável (testes). Padrão: o `fetch` global. Sempre embrulhado por `createApiFetch` (cookie e CSRF). */
  readonly fetchFn?: typeof fetch
  /** Prefixo da origem; vazio = mesma origem (proxy do Vite em dev, nginx no container). */
  readonly baseUrl?: string
}

export function createEvaluationRestClient(
  options: EvaluationRestClientOptions = {},
): EvaluationRestClient {
  const fetchFn = createApiFetch(options.fetchFn)
  const url = `${options.baseUrl ?? ''}${EVALUATIONS_PATH}`

  return {
    async evaluate(input) {
      let response: Response
      try {
        response = await fetchFn(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(toEvaluationRequestDto(input)),
        })
      } catch {
        throw new EvaluationClientError(
          CLIENT_ERROR_CODES.network,
          'Não foi possível falar com o backend (falha de rede).',
        )
      }

      const body = await readBody(response)
      if (response.status === 422) {
        throw new EvaluationClientError(
          CLIENT_ERROR_CODES.invalidRequest,
          `O backend recusou o estado enviado (HTTP 422)${describeValidationDetail(body)}.`,
        )
      }
      if (!response.ok) {
        throw new EvaluationClientError(
          CLIENT_ERROR_CODES.http,
          `O backend respondeu HTTP ${response.status}.`,
        )
      }
      try {
        return mapEvaluationResponse(body)
      } catch (error) {
        if (error instanceof ContractViolationError) {
          throw new EvaluationClientError(CLIENT_ERROR_CODES.invalidResponse, error.message)
        }
        throw error
      }
    },
  }
}

async function readBody(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown
  } catch {
    return undefined
  }
}

/** Primeiro item do `detail` do 422 do FastAPI, ex.: `: body.load_weight_kg — Input should be...`. */
function describeValidationDetail(body: unknown): string {
  if (!isRecord(body) || !Array.isArray(body.detail) || body.detail.length === 0) return ''
  const first: unknown = body.detail[0]
  if (!isRecord(first) || typeof first.msg !== 'string') return ''
  const location = Array.isArray(first.loc) ? first.loc.join('.') : ''
  return location ? `: ${location} — ${first.msg}` : `: ${first.msg}`
}

/** Converte a resposta 200 (`EvaluationResponse`) no resultado da tela, conferindo o contrato. */
export function mapEvaluationResponse(json: unknown): EvaluationResult {
  const path = 'response'
  const body = readRecord(json, path)
  const status = readString(body, 'status', path)
  const geometry = readNullableRecord(body, 'geometry', path)
  const capacityRecord = readNullableRecord(body, 'capacity', path)
  const common = {
    workingRadiusM: geometry && readNumber(geometry, 'working_radius_m', `${path}.geometry`),
    hookHeightM: geometry && readNumber(geometry, 'hook_height_m', `${path}.geometry`),
    capacity: capacityRecord && mapCapacity(capacityRecord, `${path}.capacity`),
    loadChartId: readNullableString(body, 'load_chart_id', path),
    loadChartVersion: readNullableString(body, 'load_chart_version', path),
  }

  if (status === 'EVALUATED') {
    if (common.capacity === null) throw new ContractViolationError(`${path}.capacity`, 'objeto')
    return {
      kind: 'EVALUATED',
      ...common,
      capacity: common.capacity,
      utilizationPercent: readNumber(body, 'utilization_percent', path),
    }
  }
  if (status === 'NOT_EVALUABLE') {
    const reasons = readArray(body, 'reasons', path).map((item, index): EvaluationReason => {
      const reasonPath = `${path}.reasons[${index}]`
      const reason = readRecord(item, reasonPath)
      return {
        code: readString(reason, 'code', reasonPath),
        category: readString(reason, 'category', reasonPath),
      }
    })
    return { kind: 'NOT_EVALUABLE', ...common, reasons }
  }
  throw new ContractViolationError(`${path}.status`, '"EVALUATED" ou "NOT_EVALUABLE"')
}

function mapCapacity(capacity: JsonRecord, path: string): EvaluationCapacity {
  const usedPoint = readNullableRecord(capacity, 'used_point', path)
  const usedPointPath = `${path}.used_point`
  return {
    maximumCapacityKg: readNumber(capacity, 'maximum_capacity_kg', path),
    strategy: readNullableString(capacity, 'strategy', path),
    queriedRadiusM: readNullableNumber(capacity, 'queried_working_radius_m', path),
    usedPoint: usedPoint && {
      boomLengthM: readNumber(usedPoint, 'boom_length_m', usedPointPath),
      workingRadiusM: readNumber(usedPoint, 'working_radius_m', usedPointPath),
      maxCapacityKg: readNumber(usedPoint, 'max_capacity_kg', usedPointPath),
    },
  }
}
