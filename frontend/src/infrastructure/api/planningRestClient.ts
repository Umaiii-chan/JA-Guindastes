// Cliente REST do planejamento da operação: `POST /api/v1/planning/recommend` (TASK-075; ADR-038).
// Espelha `backend/app/presentation/api/planning.py`. Mudou lá, muda aqui.

import {
  PLAN_PHASES,
  type PlanCraneDetail,
  type PlanCraneState,
  type PlanPhase,
  type PlanPlacement,
  type PlanRecommendation,
  type PlanTippingRisk,
  type PlanningRequest,
  type PlanningResult,
  type TrajectoryPoint,
} from '../../domain/planning/planning'
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
import { toScenarioSpecDto } from './scenarioRestClient'

export const PLANNING_PATH = '/api/v1/planning/recommend'

export interface PlanningRestClient {
  recommend(request: PlanningRequest, signal?: AbortSignal): Promise<PlanningResult>
}

export interface PlanningRestClientOptions {
  readonly fetchFn?: typeof fetch
  readonly baseUrl?: string
}

export function createPlanningRestClient(
  options: PlanningRestClientOptions = {},
): PlanningRestClient {
  const fetchFn = createApiFetch(options.fetchFn)

  return {
    async recommend(request, signal) {
      let response: Response
      try {
        response = await fetchFn(`${options.baseUrl ?? ''}${PLANNING_PATH}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(toPlanningDto(request)),
          signal,
        })
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
          response.status === 422 ? CLIENT_ERROR_CODES.invalidRequest : CLIENT_ERROR_CODES.http,
          response.status === 422
            ? `O planejamento não aceitou os dados${detail}.`
            : `O servidor não calculou o planejamento (HTTP ${response.status})${detail}.`,
        )
      }
      try {
        return mapPlanningResponse((await response.json()) as unknown)
      } catch (error) {
        if (error instanceof ContractViolationError) {
          throw new EvaluationClientError(CLIENT_ERROR_CODES.invalidResponse, error.message)
        }
        throw new EvaluationClientError(
          CLIENT_ERROR_CODES.invalidResponse,
          'A resposta do planejamento não é JSON.',
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

/** Pedido no JSON do backend. */
export function toPlanningDto(request: PlanningRequest): Record<string, unknown> {
  return {
    load: {
      weight_kg: request.load.weightKg,
      length_m: request.load.lengthM,
      width_m: request.load.widthM,
      height_m: request.load.heightM,
    },
    pick: { x: request.pick.x, z: request.pick.z, rotation_y_deg: request.pick.rotationYDeg },
    delivery: {
      x: request.delivery.x,
      z: request.delivery.z,
      rotation_y_deg: request.delivery.rotationYDeg,
    },
    scenario: toScenarioSpecDto(request.scenario),
    ...(request.accessoryIds.length > 0 ? { accessory_ids: request.accessoryIds } : {}),
    ...(request.hookAttachM !== undefined ? { hook_attach_m: request.hookAttachM } : {}),
  }
}

const RISKS: readonly string[] = ['LOW', 'ATTENTION', 'HIGH']

function mapState(json: unknown, path: string): PlanCraneState {
  const record = readRecord(json, path)
  return {
    boomLengthM: readNumber(record, 'boom_length_m', path),
    boomAngleDeg: readNumber(record, 'boom_angle_deg', path),
    turretRotationDeg: readNumber(record, 'turret_rotation_deg', path),
    cableLengthM: readNumber(record, 'cable_length_m', path),
  }
}

function mapPoint(json: unknown, path: string): TrajectoryPoint {
  const record = readRecord(json, path)
  const phase = readString(record, 'phase', path)
  if (!PLAN_PHASES.includes(phase as PlanPhase)) {
    throw new ContractViolationError(`${path}.phase`, PLAN_PHASES.map((p) => `"${p}"`).join(', '))
  }
  return {
    tS: readNumber(record, 't_s', path),
    craneIndex: readNumber(record, 'crane_index', path),
    state: mapState(record.state, `${path}.state`),
    phase: phase as PlanPhase,
  }
}

function mapPlacement(json: unknown, path: string): PlanPlacement {
  const record = readRecord(json, path)
  return {
    x: readNumber(record, 'x', path),
    z: readNumber(record, 'z', path),
    headingDeg: readNumber(record, 'heading_deg', path),
  }
}

function readStrings(record: Readonly<Record<string, unknown>>, key: string, path: string) {
  return readArray(record, key, path).map((item, index) => {
    if (typeof item !== 'string') {
      throw new ContractViolationError(`${path}.${key}[${index}]`, 'texto')
    }
    return item
  })
}

function mapDetail(json: unknown, path: string): PlanCraneDetail {
  const record = readRecord(json, path)
  return {
    configurationId: readString(record, 'configuration_id', path),
    manufacturerId: readString(record, 'manufacturer_id', path),
    craneId: readString(record, 'crane_id', path),
    label: readString(record, 'label', path),
    shareKg: readNumber(record, 'share_kg', path),
    boomLengthM: readNumber(record, 'boom_length_m', path),
    boomAnglePickDeg: readNumber(record, 'boom_angle_pick_deg', path),
    boomAngleDeliveryDeg: readNumber(record, 'boom_angle_delivery_deg', path),
    pickRadiusM: readNumber(record, 'pick_radius_m', path),
    deliveryRadiusM: readNumber(record, 'delivery_radius_m', path),
    swingDeg: readNumber(record, 'swing_deg', path),
    utilizationPercent: readNumber(record, 'utilization_percent', path),
    transportHeightM: readNumber(record, 'transport_height_m', path),
    crossedObstacleIds: readStrings(record, 'crossed_obstacle_ids', path),
  }
}

function mapRecommendation(json: unknown, path: string): PlanRecommendation {
  const record = readRecord(json, path)
  const kind = readString(record, 'kind', path)
  if (kind !== 'single' && kind !== 'tandem') {
    throw new ContractViolationError(`${path}.kind`, '"single" ou "tandem"')
  }
  const risk = record.tipping_risk
  if (risk !== null && (typeof risk !== 'string' || !RISKS.includes(risk))) {
    throw new ContractViolationError(`${path}.tipping_risk`, '"LOW", "ATTENTION", "HIGH" ou null')
  }
  if (typeof record.valid !== 'boolean') {
    throw new ContractViolationError(`${path}.valid`, 'booleano')
  }
  return {
    kind,
    configurationIds: readStrings(record, 'configuration_ids', path),
    placements: readArray(record, 'placements', path).map((item, index) =>
      mapPlacement(item, `${path}.placements[${index}]`),
    ),
    maxLimitUtilizationPercent: readNumber(record, 'max_limit_utilization_percent', path),
    tippingRisk: risk as PlanTippingRisk | null,
    valid: record.valid,
    summary: readString(record, 'summary', path),
    trajectory: readArray(record, 'trajectory', path).map((item, index) =>
      mapPoint(item, `${path}.trajectory[${index}]`),
    ),
    notes: readStrings(record, 'notes', path),
    details: readArray(record, 'details', path).map((item, index) =>
      mapDetail(item, `${path}.details[${index}]`),
    ),
  }
}

/** Converte a resposta 200 no resultado da tela, conferindo o contrato. */
export function mapPlanningResponse(json: unknown): PlanningResult {
  const path = 'response'
  const body = readRecord(json, path)
  return {
    recommendations: readArray(body, 'recommendations', path).map((item, index) =>
      mapRecommendation(item, `${path}.recommendations[${index}]`),
    ),
    notes: readStrings(body, 'notes', path),
  }
}
