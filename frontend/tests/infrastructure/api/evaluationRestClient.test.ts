import { describe, expect, it, vi } from 'vitest'

import {
  createEvaluationRestClient,
  EvaluationClientError,
  mapEvaluationResponse,
} from '../../../src/infrastructure/api/evaluationRestClient'
import {
  FICTICIO_INPUT,
  REST_EVALUATED,
  REST_NOT_EVALUABLE,
} from '../../fixtures/evaluationResponses'

function jsonResponse(body: unknown, status = 200): Response {
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
  return { fetchFn, client: createEvaluationRestClient({ fetchFn }) }
}

async function rejection(promise: Promise<unknown>): Promise<EvaluationClientError> {
  const error = await promise.then(
    () => {
      throw new Error('esperava rejeição')
    },
    (reason: unknown) => reason,
  )
  expect(error).toBeInstanceOf(EvaluationClientError)
  return error as EvaluationClientError
}

describe('cliente REST da avaliação', () => {
  it('envia POST /api/v1/evaluations com os nomes de campo do backend', async () => {
    const { fetchFn, client } = clientAnswering(jsonResponse(REST_EVALUATED))

    await client.evaluate(FICTICIO_INPUT)

    expect(fetchFn).toHaveBeenCalledOnce()
    const [url, init] = fetchFn.mock.calls[0]
    expect(url).toBe('/api/v1/evaluations')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(String(init?.body))).toEqual({
      configuration_id: 'CFG-FICTICIA-AVALIACAO',
      boom_length_m: 20,
      boom_angle_deg: 30,
      turret_rotation_deg: 0,
      cable_length_m: 1,
      load_weight_kg: 1500,
    })
  })

  it('mapeia a resposta avaliada, com a marca provisória e o ponto usado', async () => {
    const { client } = clientAnswering(jsonResponse(REST_EVALUATED))

    await expect(client.evaluate(FICTICIO_INPUT)).resolves.toEqual({
      kind: 'EVALUATED',
      workingRadiusM: 18.8205,
      hookHeightM: 11.5,
      capacity: {
        maximumCapacityKg: 2000,
        strategy: 'CONSERVATIVE_PROVISIONAL',
        queriedRadiusM: 18.8205,
        usedPoint: { boomLengthM: 20, workingRadiusM: 21.5, maxCapacityKg: 2000 },
      },
      utilizationPercent: 75,
      loadChartId: 'LC-FICTICIO-AVALIACAO-001',
      loadChartVersion: 'FICTICIO-AVALIACAO-v1',
      rotationZoneCode: null,
      rotationZoneName: null,
      hookBlockWeightKg: null,
      comparedWeightKg: null,
    })
  })

  it('mapeia "não avaliável" com os motivos e as categorias', () => {
    expect(mapEvaluationResponse(REST_NOT_EVALUABLE)).toEqual({
      kind: 'NOT_EVALUABLE',
      workingRadiusM: null,
      hookHeightM: null,
      capacity: null,
      loadChartId: null,
      loadChartVersion: null,
      rotationZoneCode: null,
      rotationZoneName: null,
      hookBlockWeightKg: null,
      comparedWeightKg: null,
      reasons: [
        { code: 'CRANE_GEOMETRY_NOT_FOUND', category: 'EVALUATION' },
        { code: 'ACTIVE_LOAD_CHART_NOT_FOUND', category: 'EVALUATION' },
      ],
    })
  })

  it('422 vira INVALID_REQUEST com o primeiro detalhe do FastAPI', async () => {
    const { client } = clientAnswering(
      jsonResponse(
        {
          detail: [
            {
              loc: ['body', 'load_weight_kg'],
              msg: 'Input should be greater than or equal to 0',
            },
          ],
        },
        422,
      ),
    )

    const error = await rejection(client.evaluate(FICTICIO_INPUT))

    expect(error.code).toBe('INVALID_REQUEST')
    expect(error.message).toContain('422')
    expect(error.message).toContain('body.load_weight_kg')
  })

  it('500 vira HTTP_ERROR com o código HTTP', async () => {
    const { client } = clientAnswering(new Response('Internal Server Error', { status: 500 }))

    const error = await rejection(client.evaluate(FICTICIO_INPUT))

    expect(error.code).toBe('HTTP_ERROR')
    expect(error.message).toContain('500')
  })

  it('falha de rede vira NETWORK_ERROR', async () => {
    const { client } = clientAnswering(new TypeError('Failed to fetch'))

    const error = await rejection(client.evaluate(FICTICIO_INPUT))

    expect(error.code).toBe('NETWORK_ERROR')
  })

  it.each([
    ['corpo que não é JSON', new Response('<html>', { status: 200 })],
    ['status desconhecido', jsonResponse({ ...REST_EVALUATED, status: 'WARNING' })],
    ['avaliado sem capacidade', jsonResponse({ ...REST_EVALUATED, capacity: null })],
    ['utilização em texto', jsonResponse({ ...REST_EVALUATED, utilization_percent: '75' })],
  ])('resposta fora do contrato (%s) vira INVALID_RESPONSE', async (_name, response) => {
    const { client } = clientAnswering(response)

    const error = await rejection(client.evaluate(FICTICIO_INPUT))

    expect(error.code).toBe('INVALID_RESPONSE')
  })
})
