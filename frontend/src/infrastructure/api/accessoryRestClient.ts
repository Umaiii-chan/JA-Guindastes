// Cliente REST do catálogo de acessórios de içamento (TASK-056): `GET/POST /api/v1/accessories` e
// `GET/PATCH/DELETE /api/v1/accessories/{id}`. Leitura para qualquer perfil; escrita só ADMIN (o
// `createApiFetch` já manda cookie e cabeçalho CSRF).
//
// Erros: 404 → `NOT_FOUND`, 409 → `CONFLICT`, 422 → `VALIDATION` (com o primeiro item do `detail`),
// outro HTTP → `HTTP_ERROR`, rede → `NETWORK_ERROR`, resposta fora do contrato → `INVALID_RESPONSE`.

import { type AccessoryGateway, AccessoryRequestError } from '../../application/accessory/ports'
import {
  type Accessory,
  type AccessoryChanges,
  isAccessoryType,
  type NewAccessory,
} from '../../domain/accessory/accessory'
import { detailText } from '../shared/apiErrorCode'
import {
  ContractViolationError,
  isRecord,
  readArray,
  readNullableString,
  readNumber,
  readRecord,
  readString,
} from '../shared/readJson'
import { createApiFetch } from './apiFetch'

export const ACCESSORIES_PATH = '/api/v1/accessories'

export interface AccessoryRestClientOptions {
  /** `fetch` injetável (testes). Padrão: o `fetch` global. */
  readonly fetchFn?: typeof fetch
  /** Prefixo da origem; vazio = mesma origem. */
  readonly baseUrl?: string
}

/** Corpo de `POST` e `PATCH` (`snake_case`); só os campos presentes vão no `PATCH`. */
function toDto(accessory: NewAccessory | AccessoryChanges): Record<string, unknown> {
  const dto: Record<string, unknown> = {}
  if (accessory.type !== undefined) dto.type = accessory.type
  if (accessory.name !== undefined) dto.name = accessory.name
  if (accessory.weightKg !== undefined) dto.weight_kg = accessory.weightKg
  if (accessory.riggingHeightM !== undefined) dto.rigging_height_m = accessory.riggingHeightM
  if (accessory.modelFile !== undefined) dto.model_file = accessory.modelFile
  if (accessory.credit !== undefined) dto.credit = accessory.credit
  if (accessory.license !== undefined) dto.license = accessory.license
  return dto
}

export function mapAccessory(json: unknown, path = 'accessory'): Accessory {
  const record = readRecord(json, path)
  const type = readString(record, 'type', path)
  if (!isAccessoryType(type)) throw new ContractViolationError(`${path}.type`, 'tipo conhecido')
  return {
    id: readString(record, 'id', path),
    type,
    name: readString(record, 'name', path),
    weightKg: readNumber(record, 'weight_kg', path),
    riggingHeightM: readNumber(record, 'rigging_height_m', path),
    modelFile: readNullableString(record, 'model_file', path),
    credit: readNullableString(record, 'credit', path),
    license: readNullableString(record, 'license', path),
  }
}

export function createAccessoryRestClient(
  options: AccessoryRestClientOptions = {},
): AccessoryGateway {
  const fetchFn = createApiFetch(options.fetchFn)
  const baseUrl = options.baseUrl ?? ''

  async function send(path: string, method: string, body?: unknown): Promise<Response> {
    const init: RequestInit =
      body === undefined
        ? { method, headers: { Accept: 'application/json' } }
        : {
            method,
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify(body),
          }
    let response: Response
    try {
      response = await fetchFn(`${baseUrl}${path}`, init)
    } catch {
      throw new AccessoryRequestError(
        'NETWORK_ERROR',
        'Não foi possível falar com o backend (falha de rede).',
      )
    }
    if (response.ok) return response
    const detail = await readDetail(response)
    if (response.status === 404) {
      throw new AccessoryRequestError('NOT_FOUND', detail ?? 'Acessório inexistente.')
    }
    if (response.status === 409) {
      throw new AccessoryRequestError('CONFLICT', detail ?? 'Acessório já existe.')
    }
    if (response.status === 422) {
      throw new AccessoryRequestError('VALIDATION', detail ?? 'O backend recusou os dados.')
    }
    throw new AccessoryRequestError('HTTP_ERROR', `O backend respondeu HTTP ${response.status}.`)
  }

  async function readJsonBody(response: Response): Promise<unknown> {
    try {
      return (await response.json()) as unknown
    } catch {
      throw new AccessoryRequestError('INVALID_RESPONSE', 'Resposta do backend não é JSON.')
    }
  }

  async function mapped<T>(response: Response, map: (json: unknown) => T): Promise<T> {
    const json = await readJsonBody(response)
    try {
      return map(json)
    } catch (error) {
      if (error instanceof ContractViolationError) {
        throw new AccessoryRequestError('INVALID_RESPONSE', error.message)
      }
      throw error
    }
  }

  const itemPath = (id: string) => `${ACCESSORIES_PATH}/${encodeURIComponent(id)}`

  return {
    async list() {
      const response = await send(ACCESSORIES_PATH, 'GET')
      return mapped(response, (json) => {
        const list = readArray({ list: json }, 'list', 'response')
        return list.map((item, index) => mapAccessory(item, `response[${index}]`))
      })
    },
    async get(id) {
      return mapped(await send(itemPath(id), 'GET'), (json) => mapAccessory(json))
    },
    async create(accessory) {
      return mapped(await send(ACCESSORIES_PATH, 'POST', toDto(accessory)), (json) =>
        mapAccessory(json),
      )
    },
    async update(id, changes) {
      return mapped(await send(itemPath(id), 'PATCH', toDto(changes)), (json) => mapAccessory(json))
    },
    async remove(id) {
      await send(itemPath(id), 'DELETE')
    },
  }
}

/** Mensagem do `detail`: texto (404, 409, 422 do domínio) ou o 1º item da lista do FastAPI. */
async function readDetail(response: Response): Promise<string | null> {
  try {
    const body: unknown = await response.clone().json()
    const text = detailText(body)
    if (text !== null) return text
    if (!isRecord(body) || !Array.isArray(body.detail) || body.detail.length === 0) return null
    const first: unknown = body.detail[0]
    if (!isRecord(first) || typeof first.msg !== 'string') return null
    const location = Array.isArray(first.loc) ? first.loc.slice(1).join('.') : ''
    return location ? `${location}: ${first.msg}` : first.msg
  } catch {
    return null
  }
}
