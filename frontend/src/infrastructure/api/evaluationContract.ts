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
  /** TASK-067 (RN-015): opcionais; ausentes não têm efeito. */
  readonly soil_kinds?: readonly string[]
  readonly wind_speed_ms?: number
  /** TASK-106 (RN-017): área de vento da carga, em m². */
  readonly load_wind_area_m2?: number
  readonly obstacle_conflicts?: readonly string[]
  /** TASK-107 (ADR-051): rede elétrica e contexto do içamento; ausente = não calcula. */
  readonly site?: SiteDto
}

/** `SitePayload` de `backend/app/presentation/api/site_schemas.py`. */
export interface SiteDto {
  readonly power_lines: readonly {
    readonly id: string
    readonly label: string
    readonly x1_m: number
    readonly z1_m: number
    readonly x2_m: number
    readonly z2_m: number
    readonly height_m: number
    readonly voltage_kv: number
  }[]
  readonly crane_x_m: number
  readonly crane_z_m: number
  readonly crane_heading_deg: number
  readonly load_length_m?: number
  readonly load_width_m?: number
  readonly load_height_m?: number
  readonly sling_angle_deg?: number
  readonly hook_attach_m?: number
  readonly tandem?: boolean
  readonly load_over_occupied?: boolean
}

/** O `site` da requisição (TASK-107), só quando informado. */
export function toSiteDto(input: EvaluationInput): { site?: SiteDto } {
  const site = input.site
  if (!site) return {}
  return {
    site: {
      power_lines: site.powerLines.map((line) => ({
        id: line.id,
        label: line.label,
        x1_m: line.x1M,
        z1_m: line.z1M,
        x2_m: line.x2M,
        z2_m: line.z2M,
        height_m: line.heightM,
        voltage_kv: line.voltageKv,
      })),
      crane_x_m: site.craneXM,
      crane_z_m: site.craneZM,
      crane_heading_deg: site.craneHeadingDeg,
      ...(site.loadLengthM !== undefined && { load_length_m: site.loadLengthM }),
      ...(site.loadWidthM !== undefined && { load_width_m: site.loadWidthM }),
      ...(site.loadHeightM !== undefined && { load_height_m: site.loadHeightM }),
      ...(site.slingAngleDeg !== undefined && { sling_angle_deg: site.slingAngleDeg }),
      ...(site.hookAttachM !== undefined && { hook_attach_m: site.hookAttachM }),
      ...(site.tandem !== undefined && { tandem: site.tandem }),
      ...(site.loadOverOccupied !== undefined && { load_over_occupied: site.loadOverOccupied }),
    },
  }
}

/** Campos do ambiente da requisição (TASK-067), só os informados. */
export function toEnvironmentDto(input: EvaluationInput): {
  soil_kinds?: readonly string[]
  wind_speed_ms?: number
  load_wind_area_m2?: number
  obstacle_conflicts?: readonly string[]
  site?: SiteDto
} {
  return {
    ...toSiteDto(input),
    ...(input.soilKinds && input.soilKinds.length === 4 ? { soil_kinds: input.soilKinds } : {}),
    ...(input.windSpeedMs !== undefined && { wind_speed_ms: input.windSpeedMs }),
    ...(input.loadWindAreaM2 !== undefined && { load_wind_area_m2: input.loadWindAreaM2 }),
    ...(input.obstacleConflicts && input.obstacleConflicts.length > 0
      ? { obstacle_conflicts: input.obstacleConflicts }
      : {}),
  }
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
  /** TASK-107 (ADR-051): distância às redes e classificação do içamento (só com `site`). */
  readonly power_lines?: readonly PowerLineClearanceDto[]
  readonly critical_lift?: CriticalLiftDto | null
  /** TASK-051 (RN-011): limite de capacidade do modelo e nível; `null` em `NOT_EVALUABLE`. */
  readonly capacity_limit?: CapacityLimitDto | null
}

/** `PowerLineClearanceResponse` (TASK-107; ADR-051). */
export interface PowerLineClearanceDto {
  readonly line_id: string
  readonly label: string
  readonly voltage_kv: number
  readonly required_m: number
  readonly distance_m: number
  readonly swept_distance_m: number
  readonly status: 'OK' | 'ATTENTION' | 'VIOLATION'
  readonly swept_status: 'OK' | 'ATTENTION' | 'VIOLATION'
  readonly nearest_part: 'boom' | 'cable' | 'load'
}

/** `CriticalLiftResponse` (TASK-107; ADR-051). */
export interface CriticalLiftDto {
  readonly is_critical: boolean
  readonly triggers: readonly { readonly code: string; readonly message: string }[]
  readonly plan_items: readonly string[]
}

/** `CapacityLimitResponse` (TASK-051; ADR-022). */
export interface CapacityLimitDto {
  readonly limit_percent: number
  readonly effective_capacity_kg: number
  readonly limit_utilization_percent: number
  readonly warning_band_percent: number
  readonly level: 'OK' | 'WARNING' | 'OVER'
  readonly slope_factor?: number
  readonly wind_factor?: number
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
    ...toEnvironmentDto(input),
  }
}
