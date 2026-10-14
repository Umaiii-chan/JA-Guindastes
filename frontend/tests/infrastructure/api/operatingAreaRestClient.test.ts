// Cliente REST da área de operação (TASK-055; ADR-025), com respostas FICTÍCIAS.

import { describe, expect, it, vi } from 'vitest'

import { EvaluationClientError } from '../../../src/infrastructure/api/evaluationRestClient'
import {
  createOperatingAreaRestClient,
  mapOperatingAreaResponse,
  operatingAreaPath,
} from '../../../src/infrastructure/api/operatingAreaRestClient'

export const OPERATING_AREA_BODY = {
  configuration_id: 'CFG-FICTICIA-AVALIACAO',
  boom_length_m: 20,
  load_weight_kg: 1500,
  compared_weight_kg: 1680,
  psi_step_deg: 90,
  radius_step_m: 10,
  max_radius_m: 21.5,
  cells: [
    { psi_deg: 0, radius_m: 10, level: 'RED' },
    { psi_deg: 0, radius_m: 20, level: 'GREEN' },
    { psi_deg: 90, radius_m: 20, level: 'YELLOW' },
  ],
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const REQUEST = { configurationId: 'CFG/FICTICIA', boomLengthM: 20, loadWeightKg: 1500 }

describe('cliente REST da área de operação', () => {
  it('manda lança e carga para a rota da configuração e mapeia a grade', async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => json(OPERATING_AREA_BODY))
    const client = createOperatingAreaRestClient({ fetchFn })

    const area = await client.compute({ ...REQUEST, psiStepDeg: 90, radiusStepM: 10 })

    const [url, init] = fetchFn.mock.calls[0]
    expect(url).toBe('/api/v1/configurations/CFG%2FFICTICIA/operating-area')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(init?.body as string)).toEqual({
      boom_length_m: 20,
      load_weight_kg: 1500,
      psi_step_deg: 90,
      radius_step_m: 10,
    })
    expect(area).toMatchObject({
      comparedWeightKg: 1680,
      psiStepDeg: 90,
      radiusStepM: 10,
      maxRadiusM: 21.5,
    })
    expect(area.cells).toEqual([
      { psiDeg: 0, radiusM: 10, level: 'RED' },
      { psiDeg: 0, radiusM: 20, level: 'GREEN' },
      { psiDeg: 90, radiusM: 20, level: 'YELLOW' },
    ])
  })

  it('sem passos, o corpo leva só lança e carga (valem os padrões do servidor)', async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => json(OPERATING_AREA_BODY))
    await createOperatingAreaRestClient({ fetchFn }).compute(REQUEST)

    expect(JSON.parse(fetchFn.mock.calls[0][1]?.body as string)).toEqual({
      boom_length_m: 20,
      load_weight_kg: 1500,
    })
  })

  it('HTTP 422 e 404 viram erro com a mensagem do servidor', async () => {
    const fetchFn = vi.fn<typeof fetch>(async () =>
      json({ detail: 'boom_length_m fora da faixa' }, 422),
    )
    const error = await createOperatingAreaRestClient({ fetchFn })
      .compute(REQUEST)
      .catch((reason: unknown) => reason)

    expect(error).toBeInstanceOf(EvaluationClientError)
    expect((error as EvaluationClientError).code).toBe('INVALID_REQUEST')
    expect((error as Error).message).toContain('boom_length_m fora da faixa')
  })

  it('falha de rede vira NETWORK_ERROR', async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => {
      throw new TypeError('offline')
    })
    const error = await createOperatingAreaRestClient({ fetchFn })
      .compute(REQUEST)
      .catch((reason: unknown) => reason)

    expect((error as EvaluationClientError).code).toBe('NETWORK_ERROR')
  })

  it('resposta fora do contrato vira INVALID_RESPONSE', async () => {
    const fetchFn = vi.fn<typeof fetch>(async () =>
      json({ ...OPERATING_AREA_BODY, cells: [{ psi_deg: 0, radius_m: 1, level: 'BLUE' }] }),
    )
    const error = await createOperatingAreaRestClient({ fetchFn })
      .compute(REQUEST)
      .catch((reason: unknown) => reason)

    expect((error as EvaluationClientError).code).toBe('INVALID_RESPONSE')
  })

  it('o mapeamento recusa nível desconhecido e o caminho escapa o id', () => {
    expect(() =>
      mapOperatingAreaResponse({ ...OPERATING_AREA_BODY, cells: [{ psi_deg: 0, radius_m: 1 }] }),
    ).toThrow()
    expect(operatingAreaPath('a b')).toBe('/api/v1/configurations/a%20b/operating-area')
  })
})
