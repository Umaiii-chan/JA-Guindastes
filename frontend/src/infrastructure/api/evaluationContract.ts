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
  /** Patolas (TASK-054); omitido quando a tela não as informa. */
  readonly outriggers?: OutriggersDto
  /** Inclinação residual sob o guindaste (TASK-052/055). */
  readonly ground_slope_deg?: number
  /** TASK-056 (RN-014): só vai com acessórios escolhidos. */
  readonly accessory_ids?: readonly string[]
  /** TASK-066: tipo de solo sob as sapatas (fl, fr, rl, rr); só com solo pintado. */
  readonly soil_kinds?: readonly string[]
  /** TASK-066: vento do cenário (m/s); só com vento. */
  readonly wind_speed_ms?: number
  /** TASK-066: ids de obstáculos em conflito com a operação; só quando há. */
  readonly obstacle_conflicts?: readonly string[]
}

/** Estado das patolas no JSON (leva E; TASK-054). */
export interface OutriggersDto {
  readonly extension_percent: number
  readonly jacks_set: boolean
}

export function toOutriggersDto(input: EvaluationInput): { outriggers?: OutriggersDto } {
  if (!input.outriggers) return {}
  return {
    outriggers: {
      extension_percent: input.outriggers.extensionPercent,
      jacks_set: input.outriggers.jacksSet,
    },
  }
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
  /** TASK-056 (RN-014): soma dos acessórios (`null` sem acessórios) e a lista somada. */
  readonly accessories_weight_kg?: number | null
  readonly accessories?: readonly { id: string; name: string; weight_kg: number }[]
  /** TASK-055 (RN-013). */
  readonly tipping_risk?: 'LOW' | 'ATTENTION' | 'HIGH' | null
  readonly alerts?: readonly {
    readonly code: string
    readonly severity: 'INFO' | 'ATTENTION' | 'CRITICAL'
    readonly message: string
  }[]
  /** TASK-051 (RN-011): limite de capacidade do modelo e nível; `null` em `NOT_EVALUABLE`. */
  readonly capacity_limit?: CapacityLimitDto | null
}

/** `CapacityLimitResponse` (TASK-051; ADR-022). */
export interface CapacityLimitDto {
  readonly limit_percent: number
  readonly effective_capacity_kg: number
  readonly limit_utilization_percent: number
  readonly warning_band_percent: number
  readonly level: 'OK' | 'WARNING' | 'OVER'
}

/** Campos do cenário da TASK-066 no JSON (`soil_kinds`, `wind_speed_ms`, `obstacle_conflicts`). */
export function toScenarioEvaluationDto(
  input: EvaluationInput,
): Pick<EvaluationRequestDto, 'soil_kinds' | 'wind_speed_ms' | 'obstacle_conflicts'> {
  return {
    ...(input.soilKinds && input.soilKinds.length > 0 ? { soil_kinds: input.soilKinds } : {}),
    ...(input.windSpeedMs !== undefined ? { wind_speed_ms: input.windSpeedMs } : {}),
    ...(input.obstacleConflicts && input.obstacleConflicts.length > 0
      ? { obstacle_conflicts: input.obstacleConflicts }
      : {}),
  }
}

export function toEvaluationRequestDto(input: EvaluationInput): EvaluationRequestDto {
  return {
    configuration_id: input.configurationId,
    boom_length_m: input.boomLengthM,
    boom_angle_deg: input.boomAngleDeg,
    turret_rotation_deg: input.turretRotationDeg,
    cable_length_m: input.cableLengthM,
    load_weight_kg: input.loadWeightKg,
    ...toOutriggersDto(input),
    ...(input.groundSlopeDeg !== undefined && { ground_slope_deg: input.groundSlopeDeg }),
    ...(input.accessoryIds && input.accessoryIds.length > 0
      ? { accessory_ids: input.accessoryIds }
      : {}),
    ...toScenarioEvaluationDto(input),
  }
}
