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

  return vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(String(input), 'http://localhost')
    const method = init?.method ?? 'GET'
    const body: unknown = init?.body ? JSON.parse(String(init.body)) : undefined
    const intercepted = intercept?.(method, url.pathname, body)
    if (intercepted) return intercepted

    const path = url.pathname
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
