// Contrato REST dos cadastros do catálogo (TASK-030), espelhando os schemas de
// `backend/app/presentation/api/catalog_schemas.py`. Nomes de campo do backend (snake_case, com a
// unidade no sufixo; RN-006) de um lado e do frontend do outro.

import type { CraneTechnicalSheet } from '../../domain/catalog/catalog'

export const MANUFACTURERS_PATH = '/api/v1/manufacturers'
export const CRANES_PATH = '/api/v1/cranes'

export const CONFIGURATIONS_PATH = '/api/v1/configurations'

export function craneConfigurationsPath(craneId: string): string {
  return `${CRANES_PATH}/${encodeURIComponent(craneId)}/configurations`
}

/** `PATCH` de um fabricante, guindaste ou configuração (TASK-044). */
export function manufacturerPath(manufacturerId: string): string {
  return `${MANUFACTURERS_PATH}/${encodeURIComponent(manufacturerId)}`
}

export function cranePath(craneId: string): string {
  return `${CRANES_PATH}/${encodeURIComponent(craneId)}`
}

export function configurationPath(configurationId: string): string {
  return `${CONFIGURATIONS_PATH}/${encodeURIComponent(configurationId)}`
}

/** `CraneGeometryPayload` (ADR-013 C-4). Opcionais ausentes vão como `null`. */
export interface CraneGeometryDto {
  readonly boom_pivot_offset_m: number
  readonly boom_pivot_height_m: number
  readonly boom_length_min_m: number
  readonly boom_length_max_m: number
  readonly boom_angle_min_deg: number
  readonly boom_angle_max_deg: number
  readonly cable_length_min_m: number
  readonly cable_length_max_m: number | null
  readonly turret_rotation_min_deg: number | null
  readonly turret_rotation_max_deg: number | null
}

/** `ManufacturerCreateRequest`. */
export interface ManufacturerCreateDto {
  readonly name: string
}

/** `CraneCreateRequest`. */
export interface CraneCreateDto {
  readonly manufacturer_id: string
  readonly model_name: string
}

/** `ConfigurationCreateRequest`; o guindaste vai na rota. */
export interface ConfigurationCreateDto {
  readonly name: string
  readonly geometry: CraneGeometryDto | null
}

/** `ManufacturerUpdateRequest` (TASK-044). */
export interface ManufacturerUpdateDto {
  readonly name: string
}

/** `CraneUpdateRequest` (TASK-044). */
export interface CraneUpdateDto {
  readonly model_name: string
}

/**
 * `ConfigurationUpdateRequest` (TASK-044): só os campos que mudam; ao menos um. `geometry`, quando
 * presente, substitui a ficha inteira e nunca é `null`.
 */
export interface ConfigurationUpdateDto {
  readonly name?: string
  readonly geometry?: CraneGeometryDto
}

/** Campo da ficha no backend → campo no frontend (na mesma ordem do ADR-013 C-4). */
export const SHEET_FIELD_FROM_DTO: Readonly<
  Record<keyof CraneGeometryDto, keyof CraneTechnicalSheet>
> = {
  boom_pivot_offset_m: 'boomPivotOffsetM',
  boom_pivot_height_m: 'boomPivotHeightM',
  boom_length_min_m: 'boomLengthMinM',
  boom_length_max_m: 'boomLengthMaxM',
  boom_angle_min_deg: 'boomAngleMinDeg',
  boom_angle_max_deg: 'boomAngleMaxDeg',
  cable_length_min_m: 'cableLengthMinM',
  cable_length_max_m: 'cableLengthMaxM',
  turret_rotation_min_deg: 'turretRotationMinDeg',
  turret_rotation_max_deg: 'turretRotationMaxDeg',
}

/** Campos fora da ficha, nos pedidos de criação e de alteração. */
export const REQUEST_FIELD_FROM_DTO: Readonly<Record<string, string>> = {
  name: 'name',
  model_name: 'modelName',
  manufacturer_id: 'manufacturerId',
  geometry: 'geometry',
}

export function toCraneGeometryDto(sheet: CraneTechnicalSheet): CraneGeometryDto {
  return {
    boom_pivot_offset_m: sheet.boomPivotOffsetM,
    boom_pivot_height_m: sheet.boomPivotHeightM,
    boom_length_min_m: sheet.boomLengthMinM,
    boom_length_max_m: sheet.boomLengthMaxM,
    boom_angle_min_deg: sheet.boomAngleMinDeg,
    boom_angle_max_deg: sheet.boomAngleMaxDeg,
    cable_length_min_m: sheet.cableLengthMinM,
    cable_length_max_m: sheet.cableLengthMaxM,
    turret_rotation_min_deg: sheet.turretRotationMinDeg,
    turret_rotation_max_deg: sheet.turretRotationMaxDeg,
  }
}
