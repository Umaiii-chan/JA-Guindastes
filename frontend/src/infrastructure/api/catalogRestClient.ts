// Cliente REST dos cadastros do catálogo (TASK-030): fabricantes, guindastes e configurações.
//
// Erros: 404 → `NOT_FOUND` e 409 → `CONFLICT`, com o `detail` do backend como mensagem; 422 →
// `VALIDATION`, com cada item do `detail` do FastAPI virando um erro de campo; outro HTTP →
// `HTTP_ERROR`; rede → `NETWORK_ERROR`; resposta fora do contrato → `INVALID_RESPONSE`.

import type { CatalogGateway } from '../../application/catalog/ports'
import {
  type CatalogFieldError,
  CatalogRequestError,
  type Crane,
  type CraneConfiguration,
  type CraneTechnicalSheet,
  type Manufacturer,
} from '../../domain/catalog/catalog'
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
  type CraneGeometryDto,
  craneConfigurationsPath,
  CRANES_PATH,
  MANUFACTURERS_PATH,
  REQUEST_FIELD_FROM_DTO,
  SHEET_FIELD_FROM_DTO,
  toCraneGeometryDto,
} from './catalogContract'

export interface CatalogRestClientOptions {
  /** `fetch` injetável (testes). Padrão: o `fetch` global. */
  readonly fetchFn?: typeof fetch
  /** Prefixo da origem; vazio = mesma origem (proxy do Vite em dev, nginx no container). */
  readonly baseUrl?: string
}

export function createCatalogRestClient(options: CatalogRestClientOptions = {}): CatalogGateway {
  const fetchFn = options.fetchFn ?? ((input, init) => fetch(input, init))
  const baseUrl = options.baseUrl ?? ''

  async function request<T>(path: string, body: unknown, map: (json: unknown) => T): Promise<T> {
    const init: RequestInit =
      body === undefined
        ? { method: 'GET', headers: { Accept: 'application/json' } }
        : {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify(body),
          }
    let response: Response
    try {
      response = await fetchFn(`${baseUrl}${path}`, init)
    } catch {
      throw new CatalogRequestError(
        'NETWORK_ERROR',
        'Não foi possível falar com o backend (falha de rede).',
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
    createCrane: ({ manufacturerId, modelName }) =>
      request(CRANES_PATH, { manufacturer_id: manufacturerId, model_name: modelName }, mapCrane),
    listConfigurations: (craneId) =>
      request(craneConfigurationsPath(craneId), undefined, (json) =>
        mapList(json, mapConfiguration),
      ),
    createConfiguration: (craneId, { name, geometry }) =>
      request(
        craneConfigurationsPath(craneId),
        { name, geometry: geometry && toCraneGeometryDto(geometry) },
        mapConfiguration,
      ),
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
  if (status === 422) {
    const fieldErrors = Array.isArray(detail) ? detail.map(toFieldError) : []
    return new CatalogRequestError(
      'VALIDATION',
      'O backend recusou os dados (HTTP 422). Corrija os campos indicados.',
      fieldErrors,
    )
  }
  const message = typeof detail === 'string' && detail.trim() !== '' ? detail : null
  if (status === 404) {
    return new CatalogRequestError('NOT_FOUND', message ?? 'Não encontrado (HTTP 404).')
  }
  if (status === 409) {
    return new CatalogRequestError('CONFLICT', message ?? 'Conflito ao gravar (HTTP 409).')
  }
  return new CatalogRequestError(
    'HTTP_ERROR',
    `O backend respondeu HTTP ${status}${message ? `: ${message}` : ''}.`,
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
  }
}

function mapConfiguration(json: unknown, path = 'response'): CraneConfiguration {
  const record = readRecord(json, path)
  const geometry = readNullableRecord(record, 'geometry', path)
  return {
    id: readString(record, 'id', path),
    craneId: readString(record, 'crane_id', path),
    name: readString(record, 'name', path),
    geometry: geometry && mapSheet(geometry, `${path}.geometry`),
  }
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
