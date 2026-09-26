import { describe, expect, it, vi } from 'vitest'

import type { LoadChartImportRequest } from '../../../src/application/loadChart/ports'
import {
  createLoadChartRestClient,
  LOAD_CHART_CLIENT_ERROR_CODES,
  LoadChartClientError,
} from '../../../src/infrastructure/api/loadChartRestClient'
import {
  ACTIVATED_FIRST,
  ACTIVATED_SUPERSEDING,
  IMPORTED_DRAFT,
  INVALID_REPORT,
} from '../../fixtures/loadChartResponses'

const REQUEST: LoadChartImportRequest = {
  file: new Blob(['boom_length_m,working_radius_m,max_capacity_kg\n'], { type: 'text/csv' }),
  fileName: 'tabela-ficticia.csv',
  configurationId: 'CFG-FICTICIA',
  chartId: 'TAB-FICTICIA-1',
  version: 'v2',
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function clientAnswering(response: Response | Error) {
  const fetchFn = vi.fn<typeof fetch>(async () => {
    if (response instanceof Error) throw response
    return response
  })
  return { fetchFn, client: createLoadChartRestClient({ fetchFn, baseUrl: 'http://backend' }) }
}

async function rejection(promise: Promise<unknown>): Promise<LoadChartClientError> {
  const error = await promise.then(
    () => {
      throw new Error('esperava rejeição')
    },
    (caught: unknown) => caught,
  )
  expect(error).toBeInstanceOf(LoadChartClientError)
  return error as LoadChartClientError
}

describe('createLoadChartRestClient — importação', () => {
  it('envia multipart com file, configuration_id, chart_id e version para /import', async () => {
    const { fetchFn, client } = clientAnswering(jsonResponse(IMPORTED_DRAFT, 201))

    await client.importChart(REQUEST)

    expect(fetchFn).toHaveBeenCalledTimes(1)
    const [url, init] = fetchFn.mock.calls[0]
    expect(url).toBe('http://backend/api/v1/load-charts/import')
    expect(init?.method).toBe('POST')
    const body = init?.body
    expect(body).toBeInstanceOf(FormData)
    const form = body as FormData
    expect(form.get('configuration_id')).toBe('CFG-FICTICIA')
    expect(form.get('chart_id')).toBe('TAB-FICTICIA-1')
    expect(form.get('version')).toBe('v2')
    const file = form.get('file')
    expect(file).toBeInstanceOf(Blob)
    expect((file as File).name).toBe('tabela-ficticia.csv')
    // O boundary do multipart é do navegador: o cliente não fixa Content-Type.
    expect(new Headers(init?.headers).has('Content-Type')).toBe(false)
  })

  it('201 → IMPORTED com status DRAFT e os pontos', async () => {
    const { client } = clientAnswering(jsonResponse(IMPORTED_DRAFT, 201))

    const outcome = await client.importChart(REQUEST)

    expect(outcome).toEqual({
      kind: 'IMPORTED',
      chart: {
        chartId: 'TAB-FICTICIA-1',
        version: 'v2',
        configurationId: 'CFG-FICTICIA',
        status: 'DRAFT',
        sourceFileName: 'tabela-ficticia.csv',
        points: [
          { boomLengthM: 20, workingRadiusM: 10, maxCapacityKg: 5000 },
          { boomLengthM: 20, workingRadiusM: 15.5, maxCapacityKg: 3200 },
        ],
      },
    })
  })

  it('422 com relatório → INVALID com linha, coluna, código e mensagem', async () => {
    const { client } = clientAnswering(jsonResponse(INVALID_REPORT, 422))

    const outcome = await client.importChart(REQUEST)

    expect(outcome).toEqual({
      kind: 'INVALID',
      issues: [
        {
          code: 'MISSING_COLUMN',
          message: 'Coluna obrigatória ausente: max_capacity_kg.',
          line: null,
          column: 'max_capacity_kg',
        },
        {
          code: 'INVALID_NUMBER',
          message: 'Valor não numérico: "abc".',
          line: 3,
          column: 'working_radius_m',
        },
      ],
    })
  })

  it('422 do FastAPI (requisição malformada) → erro INVALID_REQUEST com o campo', async () => {
    const { client } = clientAnswering(
      jsonResponse(
        { detail: [{ loc: ['body', 'version'], msg: 'Field required', type: 'missing' }] },
        422,
      ),
    )

    const error = await rejection(client.importChart(REQUEST))

    expect(error.code).toBe(LOAD_CHART_CLIENT_ERROR_CODES.invalidRequest)
    expect(error.httpStatus).toBe(422)
    expect(error.message).toContain('body.version — Field required')
  })

  it('415 → erro de formato não reconhecido, com o detalhe do backend', async () => {
    const { client } = clientAnswering(
      jsonResponse({ detail: 'formato de arquivo não suportado' }, 415),
    )

    const error = await rejection(client.importChart(REQUEST))

    expect(error.code).toBe(LOAD_CHART_CLIENT_ERROR_CODES.unsupportedFormat)
    expect(error.httpStatus).toBe(415)
    expect(error.message).toContain('Formato de arquivo não reconhecido (HTTP 415)')
    expect(error.message).toContain('CSV ou XLSX')
    expect(error.message).toContain('formato de arquivo não suportado')
  })

  it.each([
    [404, LOAD_CHART_CLIENT_ERROR_CODES.configurationNotFound, 'Configuração não encontrada'],
    [409, LOAD_CHART_CLIENT_ERROR_CODES.conflict, 'Conflito (HTTP 409)'],
    [413, LOAD_CHART_CLIENT_ERROR_CODES.tooLarge, 'Arquivo grande demais (HTTP 413)'],
    [500, LOAD_CHART_CLIENT_ERROR_CODES.http, 'HTTP 500'],
  ])('%i → erro %s com mensagem clara', async (status, code, text) => {
    const { client } = clientAnswering(jsonResponse({ detail: 'detalhe fictício' }, status))

    const error = await rejection(client.importChart(REQUEST))

    expect(error.code).toBe(code)
    expect(error.httpStatus).toBe(status)
    expect(error.message).toContain(text)
  })

  it('falha de rede → NETWORK_ERROR sem status HTTP', async () => {
    const { client } = clientAnswering(new TypeError('Failed to fetch'))

    const error = await rejection(client.importChart(REQUEST))

    expect(error.code).toBe(LOAD_CHART_CLIENT_ERROR_CODES.network)
    expect(error.httpStatus).toBeNull()
  })

  it('201 fora do contrato → INVALID_RESPONSE', async () => {
    const { client } = clientAnswering(jsonResponse({ ...IMPORTED_DRAFT, status: 'OUTRO' }, 201))

    const error = await rejection(client.importChart(REQUEST))

    expect(error.code).toBe(LOAD_CHART_CLIENT_ERROR_CODES.invalidResponse)
    expect(error.message).toContain('response.status')
  })
})

describe('createLoadChartRestClient — ativação', () => {
  it('200 → tabela ACTIVE e a substituída (SUPERSEDED)', async () => {
    const { fetchFn, client } = clientAnswering(jsonResponse(ACTIVATED_SUPERSEDING, 200))

    const activation = await client.activateChart('TAB-FICTICIA-1')

    const [url, init] = fetchFn.mock.calls[0]
    expect(url).toBe('http://backend/api/v1/load-charts/TAB-FICTICIA-1/activate')
    expect(init?.method).toBe('POST')
    expect(activation.chart.status).toBe('ACTIVE')
    expect(activation.supersededChartId).toBe('TAB-FICTICIA-0')
  })

  it('200 sem tabela anterior → supersededChartId null', async () => {
    const { client } = clientAnswering(jsonResponse(ACTIVATED_FIRST, 200))

    const activation = await client.activateChart('TAB-FICTICIA-1')

    expect(activation.supersededChartId).toBeNull()
  })

  it('codifica o id na URL', async () => {
    const { fetchFn, client } = clientAnswering(jsonResponse(ACTIVATED_FIRST, 200))

    await client.activateChart('TAB/1')

    expect(fetchFn.mock.calls[0][0]).toBe('http://backend/api/v1/load-charts/TAB%2F1/activate')
  })

  it.each([
    [404, LOAD_CHART_CLIENT_ERROR_CODES.chartNotFound, 'Tabela de carga não encontrada'],
    [409, LOAD_CHART_CLIENT_ERROR_CODES.conflict, 'não pode ser ativada (HTTP 409)'],
  ])('%i → erro %s', async (status, code, text) => {
    const { client } = clientAnswering(jsonResponse({ detail: 'detalhe fictício' }, status))

    const error = await rejection(client.activateChart('TAB-FICTICIA-1'))

    expect(error.code).toBe(code)
    expect(error.message).toContain(text)
    expect(error.message).toContain('detalhe fictício')
  })
})
