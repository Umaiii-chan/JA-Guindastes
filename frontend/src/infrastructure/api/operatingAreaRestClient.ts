// Cliente REST da área de operação: `POST /api/v1/configurations/{id}/operating-area` (TASK-055;
// ADR-025). Espelha `backend/app/presentation/api/operating_area.py`. Mudou lá, muda aqui.

import type {
  OperatingArea,
  OperatingAreaCell,
  OperatingAreaLevel,
  OperatingAreaRequest,
} from '../../domain/evaluation/operatingArea'
import {
  ContractViolationError,
  isRecord,
  readArray,
  readNumber,
  readRecord,
  readString,
} from '../shared/readJson'
import { createApiFetch } from './apiFetch'
import { CLIENT_ERROR_CODES, EvaluationClientError } from './evaluationRestClient'

export function operatingAreaPath(configurationId: string): string {
  return `/api/v1/configurations/${encodeURIComponent(configurationId)}/operating-area`
}

export interface OperatingAreaRestClient {
  compute(request: OperatingAreaRequest, signal?: AbortSignal): Promise<OperatingArea>
}

export interface OperatingAreaRestClientOptions {
  readonly fetchFn?: typeof fetch
  readonly baseUrl?: string
}

const LEVELS: readonly string[] = ['GREEN', 'YELLOW', 'RED']

export function createOperatingAreaRestClient(
  options: OperatingAreaRestClientOptions = {},
): OperatingAreaRestClient {
  const fetchFn = createApiFetch(options.fetchFn)

  return {
    async compute(request, signal) {
      let response: Response
      try {
        response = await fetchFn(
          `${options.baseUrl ?? ''}${operatingAreaPath(request.configurationId)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({
              boom_length_m: request.boomLengthM,
              load_weight_kg: request.loadWeightKg,
              ...(request.psiStepDeg !== undefined && { psi_step_deg: request.psiStepDeg }),
              ...(request.radiusStepM !== undefined && { radius_step_m: request.radiusStepM }),
            }),
            signal,
          },
        )
      } catch (error) {
        if (signal?.aborted) throw error
        throw new EvaluationClientError(
          CLIENT_ERROR_CODES.network,
          'Não foi possível falar com o servidor (falha de rede).',
        )
      }

      if (!response.ok) {
        const detail = await readDetail(response)
        throw new EvaluationClientError(
          response.status === 422 || response.status === 404
            ? CLIENT_ERROR_CODES.invalidRequest
            : CLIENT_ERROR_CODES.http,
          `O servidor não calculou a área de operação (HTTP ${response.status})${detail}.`,
        )
      }
      let json: unknown
      try {
        json = (await response.json()) as unknown
        return mapOperatingAreaResponse(json)
      } catch (error) {
        if (error instanceof ContractViolationError) {
          throw new EvaluationClientError(CLIENT_ERROR_CODES.invalidResponse, error.message)
        }
        throw new EvaluationClientError(
          CLIENT_ERROR_CODES.invalidResponse,
          'A resposta da área de operação não é JSON.',
        )
      }
    },
  }
}

async function readDetail(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json()
    if (isRecord(body) && typeof body.detail === 'string') return `: ${body.detail}`
  } catch {
    // Sem corpo legível: fica só o código HTTP.
  }
  return ''
}

/** Converte a resposta 200 no resultado da tela, conferindo o contrato. */
export function mapOperatingAreaResponse(json: unknown): OperatingArea {
  const path = 'response'
  const body = readRecord(json, path)
  const cells = readArray(body, 'cells', path).map((item, index): OperatingAreaCell => {
    const cellPath = `${path}.cells[${index}]`
    const cell = readRecord(item, cellPath)
    const level = readString(cell, 'level', cellPath)
    if (!LEVELS.includes(level)) {
      throw new ContractViolationError(`${cellPath}.level`, '"GREEN", "YELLOW" ou "RED"')
    }
    return {
      psiDeg: readNumber(cell, 'psi_deg', cellPath),
      radiusM: readNumber(cell, 'radius_m', cellPath),
      level: level as OperatingAreaLevel,
    }
  })
  return {
    configurationId: readString(body, 'configuration_id', path),
    boomLengthM: readNumber(body, 'boom_length_m', path),
    loadWeightKg: readNumber(body, 'load_weight_kg', path),
    comparedWeightKg: readNumber(body, 'compared_weight_kg', path),
    psiStepDeg: readNumber(body, 'psi_step_deg', path),
    radiusStepM: readNumber(body, 'radius_step_m', path),
    maxRadiusM: readNumber(body, 'max_radius_m', path),
    cells,
  }
}
