// `fetch` falso que imita as rotas do catálogo do backend (TASK-030) em memória, com dados FICTÍCIOS
// (ADR-012). Serve aos testes do cliente REST e da seleção encadeada sem servidor.

import { vi } from 'vitest'

import type { CraneGeometryDto } from '../../src/infrastructure/api/catalogContract'

interface ManufacturerRow {
  id: string
  name: string
}
interface CraneRow {
  id: string
  manufacturer_id: string
  model_name: string
}
interface ConfigurationRow {
  id: string
  crane_id: string
  name: string
  geometry: CraneGeometryDto | null
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
) {
  let nextId = 1
  const newId = (prefix: string) => `${prefix}-FICTICIO-${nextId++}`
  const byName =
    <T>(key: (row: T) => string) =>
    (a: T, b: T) =>
      key(a).localeCompare(key(b))
  const blank = (value: unknown) => typeof value !== 'string' || value.trim() === ''
  const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

  /**
   * `PATCH` dos cadastros (TASK-044): 404 se não existe; 422 com campo vazio, sem campo nenhum ou
   * `geometry: null`; 409 se o nome repete outro do mesmo nível (fabricantes; guindastes do mesmo
   * fabricante; configurações do mesmo guindaste). É a regra deste falso: basta para exercitar a tela.
   */
  function patch(path: string, body: unknown): Response {
    const request = (body ?? {}) as Record<string, unknown>
    const [, kind, rawId] = /^\/api\/v1\/(manufacturers|cranes|configurations)\/([^/]+)$/.exec(
      path,
    ) ?? [null, null, null]
    const id = rawId === null ? '' : decodeURIComponent(rawId)
    const conflict = (name: string) => jsonResponse({ detail: `Já existe "${name}".` }, 409)

    if (kind === 'manufacturers') {
      const row = data.manufacturers.find((item) => item.id === id)
      if (!row) return jsonResponse({ detail: `Fabricante ${id} não encontrado.` }, 404)
      if (blank(request.name)) {
        return jsonResponse(validationError(['name'], 'String should match pattern'), 422)
      }
      const name = String(request.name)
      if (data.manufacturers.some((item) => item.id !== id && sameName(item.name, name))) {
        return conflict(name)
      }
      row.name = name
      return jsonResponse(row)
    }
    if (kind === 'cranes') {
      const row = data.cranes.find((item) => item.id === id)
      if (!row) return jsonResponse({ detail: `Guindaste ${id} não encontrado.` }, 404)
      if (blank(request.model_name)) {
        return jsonResponse(validationError(['model_name'], 'String should match pattern'), 422)
      }
      const modelName = String(request.model_name)
      const siblings = data.cranes.filter(
        (item) => item.manufacturer_id === row.manufacturer_id && item.id !== id,
      )
      if (siblings.some((item) => sameName(item.model_name, modelName))) return conflict(modelName)
      row.model_name = modelName
      return jsonResponse(row)
    }
    if (kind === 'configurations') {
      const row = data.configurations.find((item) => item.id === id)
      if (!row) return jsonResponse({ detail: `Configuração ${id} não encontrada.` }, 404)
      if (!('name' in request) && !('geometry' in request)) {
        return jsonResponse(validationError([], 'Informe ao menos um campo.'), 422)
      }
      if ('name' in request && blank(request.name)) {
        return jsonResponse(validationError(['name'], 'String should match pattern'), 422)
      }
      if ('geometry' in request && request.geometry === null) {
        return jsonResponse(validationError(['geometry'], 'A ficha não pode ser nula.'), 422)
      }
      if ('name' in request) {
        const name = String(request.name)
        const siblings = data.configurations.filter(
          (item) => item.crane_id === row.crane_id && item.id !== id,
        )
        if (siblings.some((item) => sameName(item.name, name))) return conflict(name)
        row.name = name
      }
      if ('geometry' in request) row.geometry = request.geometry as CraneGeometryDto
      return jsonResponse(row)
    }
    return jsonResponse({ detail: 'Method Not Allowed' }, 405)
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
            .sort(byName((row) => row.name)),
        )
      }
      const request = body as { name: string; geometry: CraneGeometryDto | null }
      const row = { id: newId('CFG'), crane_id: craneId, ...request }
      data.configurations.push(row)
      return jsonResponse(row, 201)
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
