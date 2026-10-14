// Cliente REST do assistente de IA (TASK-076; ADR-039), com respostas FICTÍCIAS.

import { describe, expect, it, vi } from 'vitest'

import { AuthRequestError } from '../../../src/domain/auth/user'
import { createAiRestClient } from '../../../src/infrastructure/api/aiRestClient'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const SCENARIO_RESPONSE = {
  model: 'gemini-3-flash-preview',
  fallback_used: true,
  summary: 'Viga de 8 t içada do barracão até a carreta.',
  assumptions: ['Largura estimada.'],
  load: { description: 'Viga', weight_kg: 8000, length_m: 6, width_m: 0.4, height_m: 0.6 },
  scenario: {
    terrain: { slope_x_percent: 0, slope_z_percent: 0, features: [] },
    obstacles: [
      {
        id: 'ia-obstaculo-1',
        label: 'Carreta',
        kind: 'box',
        center_x: -8,
        center_z: 0,
        width_m: 2.5,
        depth_m: 12,
        height_m: 1.5,
        rotation_y_deg: 0,
      },
    ],
    crane: { x: 0, z: 0, heading_deg: 0 },
    cargo: { x: 12, z: 0, rotation_y_deg: 0 },
    delivery: { x: -8, z: 0, rotation_y_deg: 90, radius_m: 3 },
  },
}

describe('cliente REST do assistente de IA', () => {
  it('lê o status', async () => {
    const fetchFn = vi.fn<typeof fetch>(async () =>
      json({
        enabled: true,
        model: 'gemini-3.7-flash',
        fallback_models: ['a', 'b'],
        usage_limit_per_hour: 20,
      }),
    )

    const status = await createAiRestClient({ fetchFn }).status()

    expect(fetchFn.mock.calls[0]?.[0]).toBe('/api/v1/ai/status')
    expect(status).toEqual({
      enabled: true,
      model: 'gemini-3.7-flash',
      fallbackModels: ['a', 'b'],
      usageLimitPerHour: 20,
    })
  })

  it('com a IA desligada o modelo vem nulo', async () => {
    const fetchFn = vi.fn<typeof fetch>(async () =>
      json({ enabled: false, model: null, fallback_models: [], usage_limit_per_hour: null }),
    )

    expect(await createAiRestClient({ fetchFn }).status()).toEqual({
      enabled: false,
      model: null,
      fallbackModels: [],
      usageLimitPerHour: null,
    })
  })

  it('manda o texto e mapeia a proposta de cenário, com cargo e delivery', async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => json(SCENARIO_RESPONSE))

    const draft = await createAiRestClient({ fetchFn }).scenarioFromText('içar uma viga')

    const [url, init] = fetchFn.mock.calls[0] ?? []
    expect(url).toBe('/api/v1/ai/scenario-from-text')
    expect(init?.method).toBe('POST')
    expect(new Headers(init?.headers).get('X-Requested-With')).toBe('crane-simulator')
    expect(JSON.parse(init?.body as string)).toEqual({ text: 'içar uma viga' })
    expect(draft.model).toBe('gemini-3-flash-preview')
    expect(draft.fallbackUsed).toBe(true)
    expect(draft.load).toEqual({
      description: 'Viga',
      weightKg: 8000,
      lengthM: 6,
      widthM: 0.4,
      heightM: 0.6,
    })
    expect(draft.scenario.cargo).toEqual({ x: 12, z: 0, rotationYDeg: 0 })
    expect(draft.scenario.delivery).toEqual({ x: -8, z: 0, rotationYDeg: 90, radiusM: 3 })
    expect(draft.scenario.obstacles[0]?.label).toBe('Carreta')
    expect(draft.assumptions).toEqual(['Largura estimada.'])
  })

  it('explica a recomendação com o contexto', async () => {
    const fetchFn = vi.fn<typeof fetch>(async () =>
      json({ text: '### Por que esta opção', model: 'm', fallback_used: false }),
    )

    const text = await createAiRestClient({ fetchFn }).explainRecommendation(
      { kind: 'single' },
      { load: 1 },
    )

    expect(JSON.parse(fetchFn.mock.calls[0]?.[1]?.body as string)).toEqual({
      recommendation: { kind: 'single' },
      context: { load: 1 },
    })
    expect(text).toEqual({ markdown: '### Por que esta opção', model: 'm', fallbackUsed: false })
  })

  it('o relatório leva o estado em snake_case, a carga, o guindaste e o cenário', async () => {
    const fetchFn = vi.fn<typeof fetch>(async () =>
      json({ markdown: '# Relatório', model: 'm', fallback_used: false, evaluation: {} }),
    )

    const report = await createAiRestClient({ fetchFn }).liftReport({
      evaluation: {
        configurationId: 'CFG-1',
        boomLengthM: 18,
        boomAngleDeg: 62,
        turretRotationDeg: 90,
        cableLengthM: 5,
        loadWeightKg: 8000,
        accessoryIds: ['a1'],
      },
      load: { description: 'Viga', lengthM: 6, widthM: 0.4, heightM: 0.6 },
      craneLabel: 'Ribas · Modelo',
      scenario: {
        terrain: { slopeXPercent: 0, slopeZPercent: 0, features: [] },
        obstacles: [],
        crane: { x: 0, z: 0, headingDeg: 0 },
      },
      note: '  ',
    })

    const body = JSON.parse(fetchFn.mock.calls[0]?.[1]?.body as string) as Record<string, unknown>
    expect(fetchFn.mock.calls[0]?.[0]).toBe('/api/v1/ai/lift-report')
    expect(body.evaluation).toMatchObject({
      configuration_id: 'CFG-1',
      boom_length_m: 18,
      load_weight_kg: 8000,
      accessory_ids: ['a1'],
    })
    expect(body.load).toEqual({ description: 'Viga', length_m: 6, width_m: 0.4, height_m: 0.6 })
    expect(body.crane_label).toBe('Ribas · Modelo')
    expect(body.scenario).toMatchObject({ crane: { x: 0, z: 0, heading_deg: 0 } })
    expect(body).not.toHaveProperty('note')
    expect(report.markdown).toBe('# Relatório')
  })

  it('a revisão manda só o id da gravação', async () => {
    const fetchFn = vi.fn<typeof fetch>(async () =>
      json({ markdown: '# Revisão', model: 'm', fallback_used: false }),
    )

    await createAiRestClient({ fetchFn }).reviewRecording('g-1')

    expect(fetchFn.mock.calls[0]?.[0]).toBe('/api/v1/ai/review-recording')
    expect(JSON.parse(fetchFn.mock.calls[0]?.[1]?.body as string)).toEqual({ recording_id: 'g-1' })
  })

  it('erros do backend chegam com o código e a mensagem em pt-BR', async () => {
    const fetchFn = vi.fn<typeof fetch>(async () =>
      json(
        {
          detail: 'Você atingiu o limite de 20 usos do assistente por hora.',
          code: 'AI_RATE_LIMITED',
        },
        429,
      ),
    )

    const failure = await createAiRestClient({ fetchFn })
      .scenarioFromText('x')
      .catch((error: unknown) => error)

    expect(failure).toBeInstanceOf(AuthRequestError)
    expect(failure).toMatchObject({
      code: 'AI_RATE_LIMITED',
      httpStatus: 429,
      message: 'Você atingiu o limite de 20 usos do assistente por hora.',
    })
  })

  it('resposta fora do contrato vira INVALID_RESPONSE', async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => json({ enabled: 'sim' }))

    await expect(createAiRestClient({ fetchFn }).status()).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    })
  })

  it('falha de rede vira NETWORK_ERROR', async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => {
      throw new TypeError('falhou')
    })

    await expect(createAiRestClient({ fetchFn }).status()).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
    })
  })
})
