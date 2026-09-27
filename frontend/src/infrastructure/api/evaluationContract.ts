// Contrato REST da avaliação (TASK-024): espelha `EvaluationRequest` e `EvaluationResponse` de
// `backend/app/presentation/api/evaluation_schemas.py`. Mudou lá, muda aqui.

import type { EvaluationInput } from '../../domain/evaluation/evaluation'

export const EVALUATIONS_PATH = '/api/v1/evaluations'

/** Corpo de `POST /api/v1/evaluations`. O backend recusa campo desconhecido (422). */
export interface EvaluationRequestDto {
  readonly configuration_id: string
  readonly boom_length_m: number
  readonly boom_angle_deg: number
  readonly turret_rotation_deg: number
  readonly cable_length_m: number
  readonly load_weight_kg: number
}

export interface Point3DDto {
  readonly x_m: number
  readonly y_m: number
  readonly z_m: number
}

export interface GeometryDto {
  readonly working_radius_m: number
  readonly tip_height_m: number
  readonly hook_height_m: number
  readonly boom_pivot: Point3DDto
  readonly boom_tip: Point3DDto
  readonly hook: Point3DDto
}

/** `LoadChartPointResponse` (TASK-019). */
export interface LoadChartPointDto {
  readonly boom_length_m: number
  readonly working_radius_m: number
  readonly max_capacity_kg: number
}

export interface CapacityDto {
  readonly maximum_capacity_kg: number
  readonly strategy: string | null
  readonly queried_boom_length_m: number | null
  readonly queried_working_radius_m: number | null
  readonly used_point: LoadChartPointDto | null
}

export interface NotEvaluableReasonDto {
  readonly code: string
  /** `EVALUATION` | `OPERATIONAL_LIMIT` | `LOAD_CHART_DOMAIN`. */
  readonly category: string
}

/** Resposta 200: avaliado ou não avaliável. Sem nível de alerta (PEND-004). */
export interface EvaluationResponseDto {
  readonly status: 'EVALUATED' | 'NOT_EVALUABLE'
  readonly configuration_id: string
  readonly geometry: GeometryDto | null
  readonly capacity: CapacityDto | null
  readonly utilization_percent: number | null
  readonly load_chart_id: string | null
  readonly load_chart_version: string | null
  readonly reasons: readonly NotEvaluableReasonDto[]
  /** TASK-046 (ADR-018): a zona de giro usada e as parcelas do peso comparado. */
  readonly rotation_zone_code?: string | null
  readonly rotation_zone_name?: string | null
  readonly hook_block_weight_kg?: number
  /** Carga + gancho: o valor comparado com a capacidade. */
  readonly compared_weight_kg?: number
}

export function toEvaluationRequestDto(input: EvaluationInput): EvaluationRequestDto {
  return {
    configuration_id: input.configurationId,
    boom_length_m: input.boomLengthM,
    boom_angle_deg: input.boomAngleDeg,
    turret_rotation_deg: input.turretRotationDeg,
    cable_length_m: input.cableLengthM,
    load_weight_kg: input.loadWeightKg,
  }
}
