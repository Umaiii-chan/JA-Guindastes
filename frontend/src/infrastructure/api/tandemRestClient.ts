// Cliente REST do içamento com dois guindastes: `POST /api/v1/evaluations/tandem` (TASK-074; RN-016).
//
// Corpo (snake_case): `{ load_weight_kg, load_cg: {x, z}, cranes: [{ configuration_id,
// placement: {x, z, heading_deg}, state: {boom_length_m, boom_angle_deg, turret_rotation_deg,
// cable_length_m}, hook_point: {x, z} }] }`. Resposta: `{ shares_kg, share_percent, evaluations,
// tandem_ok, alerts }`, com cada avaliação no formato de `POST /api/v1/evaluations`.

import type { TandemInput, TandemResult } from '../../domain/tandem/tandemEvaluation'
import { readSafety } from '../shared/evaluationSafety'
import {
  ContractViolationError,
  isRecord,
  type JsonRecord,
  readArray,
  readRecord,
} from '../shared/readJson'
import { createApiFetch } from './apiFetch'
import { EVALUATIONS_PATH } from './evaluationContract'
import {
  CLIENT_ERROR_CODES,
  EvaluationClientError,
  mapEvaluationResponse,
} from './evaluationRestClient'

export const TANDEM_PATH = `${EVALUATIONS_PATH}/tandem`

export interface TandemRestClient {
  evaluate(input: TandemInput): Promise<TandemResult>
}

export interface TandemRestClientOptions {
  readonly fetchFn?: typeof fetch
  readonly baseUrl?: string
  /** Tempo máximo de uma avaliação (ms); padrão 75 s, como a avaliação individual. */
  readonly timeoutMs?: number
}

export function toTandemRequestDto(input: TandemInput): Record<string, unknown> {
  return {
    load_weight_kg: input.loadWeightKg,
    load_cg: { x: input.loadCg.x, z: input.loadCg.z },
    cranes: input.cranes.map((crane) => ({
      configuration_id: crane.configurationId,
      placement: {
        x: crane.placement.x,
        z: crane.placement.z,
        heading_deg: crane.placement.headingDeg,
      },
      state: {
        boom_length_m: crane.state.boomLengthM,
        boom_angle_deg: crane.state.boomAngleDeg,
        turret_rotation_deg: crane.state.turretRotationDeg,
        cable_length_m: crane.state.cableLengthM,
      },
      hook_point: { x: crane.hookPoint.x, z: crane.hookPoint.z },
    })),
  }
}

export function createTandemRestClient(options: TandemRestClientOptions = {}): TandemRestClient {
  const fetchFn = createApiFetch(options.fetchFn)
  const url = `${options.baseUrl ?? ''}${TANDEM_PATH}`
  return {
    async evaluate(input) {
      const timeoutMs = options.timeoutMs ?? 75_000
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      let response: Response
      try {
        response = await fetchFn(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(toTandemRequestDto(input)),
          signal: controller.signal,
        })
      } catch {
        if (controller.signal.aborted) {
          throw new EvaluationClientError(
            CLIENT_ERROR_CODES.timeout,
            `O servidor não respondeu em ${Math.round(timeoutMs / 1000)} s.`,
          )
        }
        throw new EvaluationClientError(
          CLIENT_ERROR_CODES.network,
          'Não foi possível falar com o servidor (falha de rede).',
        )
      } finally {
        clearTimeout(timer)
      }
      const body = await readBody(response)
      if (response.status === 422) {
        throw new EvaluationClientError(
          CLIENT_ERROR_CODES.invalidRequest,
          `O servidor recusou o içamento (HTTP 422)${describeDetail(body)}.`,
        )
      }
      if (!response.ok) {
        throw new EvaluationClientError(
          CLIENT_ERROR_CODES.http,
          `O servidor respondeu HTTP ${response.status}.`,
        )
      }
      try {
        return mapTandemResponse(body)
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

function describeDetail(body: unknown): string {
  if (!isRecord(body)) return ''
  if (typeof body.detail === 'string') return `: ${body.detail}`
  return ''
}

function readNumbers(record: JsonRecord, key: string, path: string): number[] {
  return readArray(record, key, path).map((value, index) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new ContractViolationError(`${path}.${key}[${index}]`, 'número finito')
    }
    return value
  })
}

/** Converte a resposta 200 do tandem no resultado da tela, conferindo o contrato. */
export function mapTandemResponse(json: unknown): TandemResult {
  const path = 'response'
  const body = readRecord(json, path)
  const evaluations = readArray(body, 'evaluations', path).map((item) =>
    mapEvaluationResponse(item),
  )
  if (evaluations.length !== 2) {
    throw new ContractViolationError(`${path}.evaluations`, 'duas avaliações')
  }
  if (typeof body.tandem_ok !== 'boolean') {
    throw new ContractViolationError(`${path}.tandem_ok`, 'booleano')
  }
  return {
    sharesKg: readNumbers(body, 'shares_kg', path),
    sharePercent: readNumbers(body, 'share_percent', path),
    evaluations,
    tandemOk: body.tandem_ok,
    alerts: readSafety(body, path).alerts,
  }
}
