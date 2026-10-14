// `fetch` falso que imita as rotas do catálogo do backend (TASK-030) em memória, com dados FICTÍCIOS
// (ADR-012). Serve aos testes do cliente REST e da seleção encadeada sem servidor.

import { vi } from 'vitest'

import type {
  CraneGeometryDto,
  RotationZoneDto,
} from '../../src/infrastructure/api/catalogContract'

interface ManufacturerRow {
  id: string
  name: string
}
interface CraneRow {
  id: string
  manufacturer_id: string
  model_name: string
  /** TASK-051: limites do modelo; ausentes = padrões do backend. */
  capacity_limit_percent?: number
  warning_band_percent?: number
  max_ground_slope_deg?: number
  max_leveling_deg?: number
  slope_derating_percent_per_deg?: number
  crane_mass_kg?: number
  outrigger_pad_area_m2?: number
}

const CRANE_LIMIT_FIELDS = [
  'capacity_limit_percent',
  'warning_band_percent',
  'max_ground_slope_deg',
  'max_leveling_deg',
  'slope_derating_percent_per_deg',
  'crane_mass_kg',
  'outrigger_pad_area_m2',
] as const
interface ConfigurationRow {
  id: string
  crane_id: string
  name: string
  geometry: CraneGeometryDto | null
  /** TASK-046: ausente conta como `null` (sem zonas). */
  rotation_zones?: RotationZoneDto[] | null
  hook_block_weight_kg?: number | null
}

export interface FakeCatalogOptions {
  /**
   * Códigos de zona que já têm tabelas, por configuração (TASK-046): remover ou renomear um deles no
   * PATCH responde 409 `ROTATION_ZONE_IN_USE`.
   */
  readonly zonesInUse?: Readonly<Record<string, readonly string[]>>
  /**
   * Configurações que já têm tabelas importadas sem zona (TASK-046): pôr zonas nelas no PATCH
   * responde 409 `ZONELESS_LOAD_CHARTS_EXIST`, na mesma posição de `ROTATION_ZONE_IN_USE`.
   */
  readonly zonelessChartsIn?: readonly string[]
}

/**
 * Conferência simplificada das zonas (TASK-046 § 3), como o backend: pelo menos 2, códigos únicos e
 * a soma das aberturas igual a 360° com fronteiras encadeadas. Devolve o problema ou `null`.
 */
function zonesProblem(zones: readonly RotationZoneDto[]): string | null {
  if (zones.length < 2) return 'as zonas de giro precisam ser pelo menos 2'
  if (zones.some((zone) => zone.name.trim() === '')) return 'o nome da zona não pode ser vazio'
  if (new Set(zones.map((zone) => zone.code)).size !== zones.length) {
    return 'o código de cada zona deve ser único'
  }
  const span = (zone: RotationZoneDto) => (((zone.end_deg - zone.start_deg) % 360) + 360) % 360
  const total = zones.reduce((sum, zone) => sum + span(zone), 0)
  const chained = zones.every((zone) => zones.some((other) => other.start_deg === zone.end_deg))
  return Math.abs(total - 360) < 1e-9 && chained
    ? null
    : 'as zonas de giro devem cobrir 360° sem sobreposição'
}

/** Como o backend (TASK-046): a resposta sempre traz as zonas e o gancho (`null` sem eles). */
function withZoneFields(row: ConfigurationRow): ConfigurationRow {
  return {
    ...row,
    rotation_zones: row.rotation_zones && row.rotation_zones.length > 0 ? row.rotation_zones : null,
    hook_block_weight_kg: row.hook_block_weight_kg ?? null,
  }
}

/** Gancho fora de 0..100000 kg: 422 padrão do FastAPI, com `detail` em lista. */
function hookWeightError(value: unknown): Response | null {
  if (typeof value !== 'number' || (value >= 0 && value <= 100_000)) return null
  return jsonResponse(
    validationError(
      ['hook_block_weight_kg'],
      value < 0
        ? 'Input should be greater than or equal to 0'
        : 'Input should be less than or equal to 100000',
    ),
    422,
  )
}

/** Corpo do 422 `INVALID_ROTATION_ZONES` do backend falso. */
export function invalidZonesError(message: string): unknown {
  return { detail: message, code: 'INVALID_ROTATION_ZONES' }
}

export interface FakeCatalogData {
  manufacturers: ManufacturerRow[]
  cranes: CraneRow[]
  configurations: ConfigurationRow[]
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Corpo do 422 do FastAPI para um campo do corpo do pedido. */
export function validationError(loc: readonly (string | number)[], msg: string): unknown {
  return { detail: [{ type: 'value_error', loc: ['body', ...loc], msg, input: null }] }
}

/**
 * Cria o `fetch` falso. `intercept` responde antes das rotas (para forçar 422, 409, atrasos...); se
 * devolver `undefined`, a rota em memória responde.
 */
export function createFakeCatalogFetch(
  data: FakeCatalogData,
  intercept?: (
    method: string,
    path: string,
    body: unknown,
  ) => Response | Promise<Response> | undefined,
  options: FakeCatalogOptions = {},
) {
  let nextId = 1
  const newId = (prefix: string) => `${prefix}-FICTICIO-${nextId++}`
  const byName =
    <T>(key: (row: T) => string) =>
    (a: T, b: T) =>
      key(a).localeCompare(key(b))
  const blank = (value: unknown) => typeof value !== 'string' || value.trim() === ''

  /**
   * `PATCH` dos cadastros, no contrato da TASK-044: o corpo é validado antes de procurar o item
   * (422 no formato do FastAPI para campo vazio ou `null`, campo desconhecido como `id`/`crane_id`/
   * `manufacturer_id`, ou nenhum campo); depois, 404 `{detail}` se o item não existe. Nomes não são
   * únicos: não há 409. `geometry` substitui a ficha inteira.
   */
  function patch(path: string, body: unknown): Response {
    const request = (body ?? {}) as Record<string, unknown>
    const [, kind, rawId] = /^\/api\/v1\/(manufacturers|cranes|configurations)\/([^/]+)$/.exec(
      path,
    ) ?? [null, null, null]
    const id = rawId === null ? '' : decodeURIComponent(rawId)
    const allowed = {
      manufacturers: ['name'],
      cranes: ['model_name', ...CRANE_LIMIT_FIELDS],
      configurations: ['name', 'geometry', 'rotation_zones', 'hook_block_weight_kg'],
    }
    if (kind === null) return jsonResponse({ detail: 'Method Not Allowed' }, 405)

    const unknown = Object.keys(request).find(
      (key) => !allowed[kind as keyof typeof allowed].includes(key),
    )
    if (unknown !== undefined) {
      return jsonResponse(validationError([unknown], 'Extra inputs are not permitted'), 422)
    }
    const notFound = (entity: string) =>
      jsonResponse({ detail: `${entity} com id '${id}' não existe` }, 404)

    if (kind === 'manufacturers') {
      if (blank(request.name)) {
        return jsonResponse(validationError(['name'], 'String should match pattern'), 422)
      }
      const row = data.manufacturers.find((item) => item.id === id)
      if (!row) return notFound('fabricante')
      row.name = String(request.name)
      return jsonResponse(row)
    }
    if (kind === 'cranes') {
      if (blank(request.model_name)) {
        return jsonResponse(validationError(['model_name'], 'String should match pattern'), 422)
      }
      const row = data.cranes.find((item) => item.id === id)
      if (!row) return notFound('guindaste')
      row.model_name = String(request.model_name)
      for (const field of CRANE_LIMIT_FIELDS) {
        if (typeof request[field] === 'number') row[field] = request[field]
      }
      return jsonResponse(row)
    }
    if (Object.keys(request).length === 0) {
      return jsonResponse(validationError([], 'Informe ao menos um campo.'), 422)
    }
    if ('name' in request && blank(request.name)) {
      return jsonResponse(validationError(['name'], 'String should match pattern'), 422)
    }
    if ('geometry' in request && request.geometry === null) {
      return jsonResponse(validationError(['geometry'], 'Input should be a valid dictionary'), 422)
    }
    // Ordem do backend (TASK-046): 422 padrão → 422 INVALID_ROTATION_ZONES → 404 → 409.
    const hookError = hookWeightError(request.hook_block_weight_kg)
    if (hookError) return hookError
    const zones = request.rotation_zones as RotationZoneDto[] | null | undefined
    if (zones !== undefined && zones !== null && zones.length > 0) {
      const problem = zonesProblem(zones)
      if (problem) return jsonResponse(invalidZonesError(problem), 422)
    }
    const row = data.configurations.find((item) => item.id === id)
    if (!row) return notFound('configuração')
    if (zones !== undefined) {
      const kept = new Set((zones ?? []).map((zone) => zone.code))
      const lost = (options.zonesInUse?.[id] ?? []).filter((code) => !kept.has(code))
      if (lost.length > 0) {
        return jsonResponse(
          {
            detail: `a zona ${lost.join(', ')} já tem tabelas de carga`,
            code: 'ROTATION_ZONE_IN_USE',
          },
          409,
        )
      }
      const addsZones = zones !== null && zones.length > 0 && !row.rotation_zones?.length
      if (addsZones && options.zonelessChartsIn?.includes(id)) {
        return jsonResponse(
          {
            detail: 'a configuração já tem tabelas de carga sem zona',
            code: 'ZONELESS_LOAD_CHARTS_EXIST',
          },
          409,
        )
      }
      row.rotation_zones = zones && zones.length > 0 ? zones : null
    }
    if ('name' in request) row.name = String(request.name)
    if ('geometry' in request) row.geometry = request.geometry as CraneGeometryDto
    if ('hook_block_weight_kg' in request) {
      row.hook_block_weight_kg = request.hook_block_weight_kg as number | null
    }
    return jsonResponse(withZoneFields(row))
  }

  return vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(String(input), 'http://localhost')
    const method = init?.method ?? 'GET'
    const body: unknown = init?.body ? JSON.parse(String(init.body)) : undefined
    const intercepted = intercept?.(method, url.pathname, body)
    if (intercepted) return intercepted

    const path = url.pathname
    if (method === 'PATCH') return patch(path, body)
    if (path === '/api/v1/manufacturers') {
      if (method === 'GET') {
        return jsonResponse([...data.manufacturers].sort(byName((row) => row.name)))
      }
      const { name } = body as { name: string }
      if (name.trim() === '')
        return jsonResponse(validationError(['name'], 'String should match pattern'), 422)
      const row = { id: newId('FAB'), name }
      data.manufacturers.push(row)
      return jsonResponse(row, 201)
    }
    if (path === '/api/v1/cranes') {
      if (method === 'GET') {
        const manufacturerId = url.searchParams.get('manufacturer_id')
        if (manufacturerId && !data.manufacturers.some((row) => row.id === manufacturerId)) {
          return jsonResponse({ detail: `Fabricante ${manufacturerId} não encontrado.` }, 404)
        }
        return jsonResponse(
          data.cranes
            .filter((row) => !manufacturerId || row.manufacturer_id === manufacturerId)
            .sort(byName((row) => row.model_name)),
        )
      }
      const request = body as { manufacturer_id: string; model_name: string }
      if (!data.manufacturers.some((row) => row.id === request.manufacturer_id)) {
        return jsonResponse(
          { detail: `Fabricante ${request.manufacturer_id} não encontrado.` },
          404,
        )
      }
      const row = { id: newId('GUI'), ...request }
      data.cranes.push(row)
      return jsonResponse(row, 201)
    }
    const configurations = /^\/api\/v1\/cranes\/([^/]+)\/configurations$/.exec(path)
    if (configurations) {
      const craneId = decodeURIComponent(configurations[1])
      if (!data.cranes.some((row) => row.id === craneId)) {
        return jsonResponse({ detail: `Guindaste ${craneId} não encontrado.` }, 404)
      }
      if (method === 'GET') {
        return jsonResponse(
          data.configurations
            .filter((row) => row.crane_id === craneId)
            .sort(byName((row) => row.name))
            .map(withZoneFields),
        )
      }
      const request = body as Omit<ConfigurationRow, 'id' | 'crane_id'>
      const hookError = hookWeightError(request.hook_block_weight_kg)
      if (hookError) return hookError
      if (request.rotation_zones) {
        const problem = zonesProblem(request.rotation_zones)
        if (problem) return jsonResponse(invalidZonesError(problem), 422)
      }
      const row: ConfigurationRow = {
        id: newId('CFG'),
        crane_id: craneId,
        rotation_zones: null,
        hook_block_weight_kg: null,
        ...request,
      }
      data.configurations.push(row)
      return jsonResponse(withZoneFields(row), 201)
    }
    return jsonResponse({ detail: 'Not Found' }, 404)
  })
}

/** Promessa que o teste resolve quando quiser (para simular respostas fora de ordem). */
export function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
