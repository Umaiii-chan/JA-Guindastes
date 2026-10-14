// Cliente REST dos cadastros do catálogo (TASK-030): fabricantes, guindastes e configurações. Alterar
// (TASK-044): `PATCH /api/v1/manufacturers/{id}` `{name}`, `PATCH /api/v1/cranes/{id}` `{model_name}`
// e `PATCH /api/v1/configurations/{id}` `{name?, geometry?}`, com as respostas da criação.
//
// Erros: 404 → `NOT_FOUND` e 409 → `CONFLICT`, com o `detail` do backend como mensagem; 422 →
// `VALIDATION`, com cada item do `detail` do FastAPI virando um erro de campo; outro HTTP →
// `HTTP_ERROR`; rede → `NETWORK_ERROR`; resposta fora do contrato → `INVALID_RESPONSE`.
//
// Zonas de giro e peso do gancho (TASK-046 § 3): `rotation_zones` e `hook_block_weight_kg` na
// criação (só quando informados), no PATCH (lista vazia vai como `null` e remove as zonas) e na
// resposta (ausentes = sem zonas e sem gancho). 409 `ROTATION_ZONE_IN_USE` e
// `ZONELESS_LOAD_CHARTS_EXIST` e 422
// `INVALID_ROTATION_ZONES` vêm com `apiCode`; o 422 das zonas vira erro do campo `rotationZones`.

import type { CatalogGateway } from '../../application/catalog/ports'
import {
  type CatalogFieldError,
  CatalogRequestError,
  type Crane,
  type CraneConfiguration,
  type CraneLimits,
  type CraneTechnicalSheet,
  type Manufacturer,
  type RotationZone,
  ZONELESS_LOAD_CHARTS_EXIST,
  ZONELESS_LOAD_CHARTS_MESSAGE,
} from '../../domain/catalog/catalog'
import {
  CONFIGURATION_ZONE_ERROR_CODES,
  detailText,
  findApiErrorCode,
} from '../shared/apiErrorCode'
import {
  ContractViolationError,
  isRecord,
  type JsonRecord,
  readNullableNumber,
  readNullableRecord,
  readNumber,
  readRecord,
  readString,
} from '../shared/readJson'
import {
  type ConfigurationCreateDto,
  type ConfigurationUpdateDto,
  configurationPath,
  INVALID_ROTATION_ZONES,
  ROTATION_ZONE_IN_USE,
  toRotationZoneDto,
  type CraneCreateDto,
  type CraneGeometryDto,
  cranePath,
  type CraneUpdateDto,
  craneConfigurationsPath,
  CRANES_PATH,
  manufacturerPath,
  type ManufacturerUpdateDto,
  MANUFACTURERS_PATH,
  REQUEST_FIELD_FROM_DTO,
  SHEET_FIELD_FROM_DTO,
  toCraneGeometryDto,
  toCraneLimitsDto,
} from './catalogContract'
import { createApiFetch } from './apiFetch'

export interface CatalogRestClientOptions {
  /** `fetch` injetável (testes). Padrão: o `fetch` global. Sempre embrulhado por `createApiFetch` (cookie e CSRF). */
  readonly fetchFn?: typeof fetch
  /** Prefixo da origem; vazio = mesma origem (proxy do Vite em dev, nginx no container). */
  readonly baseUrl?: string
}

export function createCatalogRestClient(options: CatalogRestClientOptions = {}): CatalogGateway {
  const fetchFn = createApiFetch(options.fetchFn)
  const baseUrl = options.baseUrl ?? ''

  async function request<T>(
    path: string,
    body: unknown,
    map: (json: unknown) => T,
    method: 'POST' | 'PATCH' = 'POST',
  ): Promise<T> {
    const init: RequestInit =
      body === undefined
        ? { method: 'GET', headers: { Accept: 'application/json' } }
        : {
            method,
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify(body),
          }
    let response: Response
    try {
      response = await fetchFn(`${baseUrl}${path}`, init)
    } catch {
      throw new CatalogRequestError(
        'NETWORK_ERROR',
        'Não foi possível falar com o servidor (falha de rede).',
      )
    }
    const json = await readBody(response)
    if (!response.ok) throw errorFromResponse(response.status, json)
    try {
      return map(json)
    } catch (error) {
      if (error instanceof ContractViolationError) {
        throw new CatalogRequestError('INVALID_RESPONSE', error.message)
      }
      throw error
    }
  }

  return {
    listManufacturers: () =>
      request(MANUFACTURERS_PATH, undefined, (json) => mapList(json, mapManufacturer)),
    createManufacturer: (name) => request(MANUFACTURERS_PATH, { name }, mapManufacturer),
    listCranes: (manufacturerId) =>
      request(
        `${CRANES_PATH}?manufacturer_id=${encodeURIComponent(manufacturerId)}`,
        undefined,
        (json) => mapList(json, mapCrane),
      ),
    createCrane: ({ manufacturerId, modelName, limits }) =>
      request(
        CRANES_PATH,
        {
          manufacturer_id: manufacturerId,
          model_name: modelName,
          ...toCraneLimitsDto(limits),
        } satisfies CraneCreateDto,
        mapCrane,
      ),
    listConfigurations: (craneId) =>
      request(craneConfigurationsPath(craneId), undefined, (json) =>
        mapList(json, mapConfiguration),
      ),
    createConfiguration: (craneId, { name, geometry, rotationZones, hookBlockWeightKg }) => {
      // Zonas e gancho só vão quando informados (TASK-046): ausentes valem "sem zonas" e "sem gancho".
      const body: ConfigurationCreateDto = {
        name,
        geometry: geometry && toCraneGeometryDto(geometry),
        ...(rotationZones !== undefined &&
          rotationZones.length > 0 && { rotation_zones: rotationZones.map(toRotationZoneDto) }),
        ...(hookBlockWeightKg !== undefined &&
          hookBlockWeightKg !== null && { hook_block_weight_kg: hookBlockWeightKg }),
      }
      return request(craneConfigurationsPath(craneId), body, mapConfiguration)
    },
    updateManufacturer: (manufacturerId, name) =>
      request(
        manufacturerPath(manufacturerId),
        { name } satisfies ManufacturerUpdateDto,
        mapManufacturer,
        'PATCH',
      ),
    updateCrane: (craneId, modelName, limits) =>
      request(
        cranePath(craneId),
        { model_name: modelName, ...toCraneLimitsDto(limits) } satisfies CraneUpdateDto,
        mapCrane,
        'PATCH',
      ),
    updateConfiguration: (
      configurationId,
      { name, geometry, rotationZones, hookBlockWeightKg },
    ) => {
      const body: ConfigurationUpdateDto = {
        ...(name !== undefined && { name }),
        ...(geometry !== undefined && { geometry: toCraneGeometryDto(geometry) }),
        // Lista vazia remove as zonas: vai `null` explícito (TASK-046 § 3).
        ...(rotationZones !== undefined && {
          rotation_zones: rotationZones.length > 0 ? rotationZones.map(toRotationZoneDto) : null,
        }),
        ...(hookBlockWeightKg !== undefined && { hook_block_weight_kg: hookBlockWeightKg }),
      }
      return request(configurationPath(configurationId), body, mapConfiguration, 'PATCH')
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

function errorFromResponse(status: number, body: unknown): CatalogRequestError {
  const detail = isRecord(body) ? body.detail : undefined
  const apiCode = findApiErrorCode(body, CONFIGURATION_ZONE_ERROR_CODES)
  const message = detailText(body)
  if (status === 422) {
    const fieldErrors = Array.isArray(detail) ? detail.map(toFieldError) : []
    if (apiCode === INVALID_ROTATION_ZONES) {
      // Erro das zonas como um todo (cobertura, sobreposição, contagem): vai para o editor de zonas.
      const zoneMessage =
        message ??
        fieldErrors.find((item) => item.field.startsWith('rotationZones'))?.message ??
        'As zonas precisam cobrir os 360° sem sobreposição, com pelo menos 2 zonas.'
      return new CatalogRequestError(
        'VALIDATION',
        'O servidor recusou as zonas de giro (HTTP 422 INVALID_ROTATION_ZONES).',
        [
          { field: 'rotationZones', message: zoneMessage },
          ...fieldErrors.filter((item) => item.field !== 'rotationZones'),
        ],
        apiCode,
      )
    }
    return new CatalogRequestError(
      'VALIDATION',
      'O servidor recusou os dados (HTTP 422). Corrija os campos indicados.',
      fieldErrors,
      apiCode,
    )
  }
  if (status === 404) {
    return new CatalogRequestError('NOT_FOUND', message ?? 'Não encontrado (HTTP 404).')
  }
  if (status === 409 && apiCode === ROTATION_ZONE_IN_USE) {
    return new CatalogRequestError(
      'CONFLICT',
      'Uma zona que já tem tabelas de carga foi removida ou mudou de código (HTTP 409 ' +
        'ROTATION_ZONE_IN_USE). Mantenha o código dessa zona; o nome e os ângulos podem mudar.' +
        (message ? ` Detalhe do servidor: ${message}` : ''),
      [],
      apiCode,
    )
  }
  if (status === 409 && apiCode === ZONELESS_LOAD_CHARTS_EXIST) {
    return new CatalogRequestError(
      'CONFLICT',
      `${ZONELESS_LOAD_CHARTS_MESSAGE} (HTTP 409 ZONELESS_LOAD_CHARTS_EXIST)` +
        (message ? ` Detalhe do servidor: ${message}` : ''),
      [],
      apiCode,
    )
  }
  if (status === 409) {
    return new CatalogRequestError('CONFLICT', message ?? 'Conflito ao gravar (HTTP 409).')
  }
  return new CatalogRequestError(
    'HTTP_ERROR',
    `O servidor respondeu HTTP ${status}${message ? `: ${message}` : ''}.`,
  )
}

/**
 * Um item do `detail` do 422 do FastAPI (`{loc, msg}`). `loc` começa com `"body"`; o resto vira o
 * caminho do campo com os nomes do frontend (ex.: `["body", "geometry", "boom_length_min_m"]` →
 * `geometry.boomLengthMinM`). Erro da ficha inteira (validação do domínio) fica em `geometry`.
 */
function toFieldError(item: unknown): CatalogFieldError {
  if (!isRecord(item)) return { field: '', message: 'Dado inválido.' }
  const message = typeof item.msg === 'string' ? item.msg : 'Dado inválido.'
  const loc = Array.isArray(item.loc) ? item.loc.map(String) : []
  const path = loc[0] === 'body' ? loc.slice(1) : loc
  const field = path
    .map((part, index) => {
      if (index > 0 && path[0] === 'geometry' && Object.hasOwn(SHEET_FIELD_FROM_DTO, part)) {
        return SHEET_FIELD_FROM_DTO[part as keyof CraneGeometryDto]
      }
      return REQUEST_FIELD_FROM_DTO[part] ?? part
    })
    .join('.')
  return { field, message }
}

function mapList<T>(json: unknown, mapItem: (item: unknown, path: string) => T): readonly T[] {
  if (!Array.isArray(json)) throw new ContractViolationError('response', 'lista')
  return json.map((item, index) => mapItem(item, `response[${index}]`))
}

function mapManufacturer(json: unknown, path = 'response'): Manufacturer {
  const record = readRecord(json, path)
  return { id: readString(record, 'id', path), name: readString(record, 'name', path) }
}

function mapCrane(json: unknown, path = 'response'): Crane {
  const record = readRecord(json, path)
  return {
    id: readString(record, 'id', path),
    manufacturerId: readString(record, 'manufacturer_id', path),
    modelName: readString(record, 'model_name', path),
    ...readCraneLimits(record, path),
  }
}

/** Limites do modelo (TASK-051); ausentes (backend anterior) ficam de fora. */
function readCraneLimits(record: JsonRecord, path: string): Partial<CraneLimits> {
  const limits: { -readonly [K in keyof CraneLimits]?: number } = {}
  const fields = [
    ['capacity_limit_percent', 'capacityLimitPercent'],
    ['warning_band_percent', 'warningBandPercent'],
    ['max_ground_slope_deg', 'maxGroundSlopeDeg'],
    ['max_leveling_deg', 'maxLevelingDeg'],
    ['slope_derating_percent_per_deg', 'slopeDeratingPercentPerDeg'],
    ['crane_mass_kg', 'craneMassKg'],
    ['outrigger_pad_area_m2', 'outriggerPadAreaM2'],
  ] as const
  for (const [key, name] of fields) {
    if (key in record) limits[name] = readNumber(record, key, path)
  }
  return limits
}

function mapConfiguration(json: unknown, path = 'response'): CraneConfiguration {
  const record = readRecord(json, path)
  const geometry = readNullableRecord(record, 'geometry', path)
  return {
    id: readString(record, 'id', path),
    craneId: readString(record, 'crane_id', path),
    name: readString(record, 'name', path),
    geometry: geometry && mapSheet(geometry, `${path}.geometry`),
    rotationZones: mapRotationZones(record, path),
    hookBlockWeightKg: readNullableNumber(record, 'hook_block_weight_kg', path),
  }
}

/** `rotation_zones` (TASK-046): `null` ou ausente = sem zonas (lista vazia). */
function mapRotationZones(record: JsonRecord, path: string): readonly RotationZone[] {
  const value = record.rotation_zones
  if (value === null || value === undefined) return []
  if (!Array.isArray(value)) throw new ContractViolationError(`${path}.rotation_zones`, 'lista')
  return value.map((item, index) => {
    const zonePath = `${path}.rotation_zones[${index}]`
    const zone = readRecord(item, zonePath)
    return {
      code: readString(zone, 'code', zonePath),
      name: readString(zone, 'name', zonePath),
      startDeg: readNumber(zone, 'start_deg', zonePath),
      endDeg: readNumber(zone, 'end_deg', zonePath),
    }
  })
}

function mapSheet(record: JsonRecord, path: string): CraneTechnicalSheet {
  return {
    boomPivotOffsetM: readNumber(record, 'boom_pivot_offset_m', path),
    boomPivotHeightM: readNumber(record, 'boom_pivot_height_m', path),
    boomLengthMinM: readNumber(record, 'boom_length_min_m', path),
    boomLengthMaxM: readNumber(record, 'boom_length_max_m', path),
    boomAngleMinDeg: readNumber(record, 'boom_angle_min_deg', path),
    boomAngleMaxDeg: readNumber(record, 'boom_angle_max_deg', path),
    cableLengthMinM: readNumber(record, 'cable_length_min_m', path),
    cableLengthMaxM: readNullableNumber(record, 'cable_length_max_m', path),
    turretRotationMinDeg: readNullableNumber(record, 'turret_rotation_min_deg', path),
    turretRotationMaxDeg: readNullableNumber(record, 'turret_rotation_max_deg', path),
  }
}
