// `fetch` central da API (TASK-040; ADR-016 § 3): cookie da mesma origem, cabeçalho contra CSRF nos
// métodos inseguros e aviso de sessão acabada (401) ou perfil insuficiente (403).

import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  type ApiAuthEvent,
  createApiFetch,
  onApiAuthEvent,
} from '../../../src/infrastructure/api/apiFetch'
import { createCatalogRestClient } from '../../../src/infrastructure/api/catalogRestClient'
import { createEvaluationRestClient } from '../../../src/infrastructure/api/evaluationRestClient'
import { createLoadChartRestClient } from '../../../src/infrastructure/api/loadChartRestClient'
import { FICTICIO_INPUT } from '../../fixtures/evaluationResponses'
import { jsonResponse } from '../../helpers/fakeCatalogFetch'

function recorder(response: () => Response = () => jsonResponse({})) {
  return vi.fn<typeof fetch>(async () => response())
}

function headersOf(fetchFn: ReturnType<typeof recorder>, call = 0): Headers {
  return new Headers(fetchFn.mock.calls[call][1]?.headers)
}

const unsubscribers: (() => void)[] = []

function listen(): ApiAuthEvent[] {
  const events: ApiAuthEvent[] = []
  unsubscribers.push(onApiAuthEvent((event) => events.push(event)))
  return events
}

afterEach(() => {
  while (unsubscribers.length) unsubscribers.pop()?.()
})

describe('createApiFetch', () => {
  it('manda o cookie da mesma origem em toda chamada e o cabeçalho CSRF só nos métodos inseguros', async () => {
    const fetchFn = recorder()
    const api = createApiFetch(fetchFn)

    await api('/api/v1/x', { method: 'GET', headers: { Accept: 'application/json' } })
    await api('/api/v1/x')
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'post']) {
      await api('/api/v1/x', { method })
    }

    for (const [, init] of fetchFn.mock.calls) expect(init?.credentials).toBe('same-origin')
    expect(headersOf(fetchFn, 0).get('X-Requested-With')).toBeNull()
    expect(headersOf(fetchFn, 0).get('Accept')).toBe('application/json')
    expect(headersOf(fetchFn, 1).get('X-Requested-With')).toBeNull()
    for (let call = 2; call < 7; call++) {
      expect(headersOf(fetchFn, call).get('X-Requested-With')).toBe('crane-simulator')
    }
  })

  it('401 NOT_AUTHENTICATED avisa "sessão acabou" e devolve a resposta intacta', async () => {
    const events = listen()
    const api = createApiFetch(
      recorder(() => jsonResponse({ detail: 'Faça login.', code: 'NOT_AUTHENTICATED' }, 401)),
    )
    const response = await api('/api/v1/manufacturers')
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ detail: 'Faça login.', code: 'NOT_AUTHENTICATED' })
    expect(events).toEqual([{ kind: 'unauthenticated', message: 'Faça login.' }])
  })

  it('401 INVALID_CREDENTIALS (senha errada no login) não avisa nada', async () => {
    const events = listen()
    const api = createApiFetch(
      recorder(() => jsonResponse({ detail: 'x', code: 'INVALID_CREDENTIALS' }, 401)),
    )
    await api('/api/v1/auth/login', { method: 'POST' })
    expect(events).toEqual([])
  })

  it('403 FORBIDDEN avisa "sem permissão"; 403 de outro código, não', async () => {
    const events = listen()
    await createApiFetch(
      recorder(() => jsonResponse({ detail: 'Só ADMIN.', code: 'FORBIDDEN' }, 403)),
    )('/api/v1/users')
    await createApiFetch(
      recorder(() => jsonResponse({ detail: 'x', code: 'CSRF_HEADER_MISSING' }, 403)),
    )('/api/v1/users', { method: 'POST' })
    expect(events).toEqual([{ kind: 'forbidden', message: 'Só ADMIN.' }])
  })

  it('o cancelamento para de avisar', async () => {
    const events: ApiAuthEvent[] = []
    const stop = onApiAuthEvent((event) => events.push(event))
    stop()
    await createApiFetch(recorder(() => jsonResponse({ code: 'NOT_AUTHENTICATED' }, 401)))('/x')
    expect(events).toEqual([])
  })
})

describe('clientes REST existentes passam pelo fetch central', () => {
  it('catálogo: GET com cookie; POST com cookie e cabeçalho CSRF', async () => {
    const fetchFn = recorder(() => jsonResponse({ id: 'FAB-1', name: 'FICTÍCIO' }, 201))
    const client = createCatalogRestClient({ fetchFn })
    await client.createManufacturer('FICTÍCIO')
    expect(fetchFn.mock.calls[0][1]?.credentials).toBe('same-origin')
    expect(headersOf(fetchFn).get('X-Requested-With')).toBe('crane-simulator')
    expect(headersOf(fetchFn).get('Content-Type')).toBe('application/json')

    const listFetch = recorder(() => jsonResponse([]))
    await createCatalogRestClient({ fetchFn: listFetch }).listManufacturers()
    expect(listFetch.mock.calls[0][1]?.credentials).toBe('same-origin')
    expect(headersOf(listFetch).get('X-Requested-With')).toBeNull()
  })

  it('avaliação REST e ativação de tabela mandam o cabeçalho CSRF', async () => {
    const evaluationFetch = recorder(() => jsonResponse({}, 500))
    await createEvaluationRestClient({ fetchFn: evaluationFetch })
      .evaluate(FICTICIO_INPUT)
      .catch(() => undefined)
    expect(headersOf(evaluationFetch).get('X-Requested-With')).toBe('crane-simulator')

    const chartFetch = recorder(() => jsonResponse({}, 500))
    await createLoadChartRestClient({ fetchFn: chartFetch })
      .activateChart('TAB-1')
      .catch(() => undefined)
    expect(chartFetch.mock.calls[0][1]?.credentials).toBe('same-origin')
    expect(headersOf(chartFetch).get('X-Requested-With')).toBe('crane-simulator')
  })
})
