// Cliente REST do içamento com dois guindastes (TASK-074; RN-016). Dados FICTÍCIOS (ADR-012).

import { describe, expect, it, vi } from 'vitest'

import { EMPTY_SCENARIO, type ScenarioSpec } from '../../../src/domain/environment/environment'
import type { TandemInput } from '../../../src/domain/tandem/tandemEvaluation'
import {
  mapScenarioSpec,
  toScenarioSpecDto,
} from '../../../src/infrastructure/api/scenarioRestClient'
import {
  createTandemRestClient,
  mapTandemResponse,
  TANDEM_PATH,
  toTandemRequestDto,
} from '../../../src/infrastructure/api/tandemRestClient'
import { EvaluationClientError } from '../../../src/infrastructure/api/evaluationRestClient'
import { REST_EVALUATED } from '../../fixtures/evaluationResponses'

const STATE = { boomLengthM: 12, boomAngleDeg: 30, turretRotationDeg: 5, cableLengthM: 6 }

const INPUT: TandemInput = {
  loadWeightKg: 4600,
  loadCg: { x: 4, z: 10.5 },
  cranes: [
    {
      configurationId: 'CFG-1',
      placement: { x: 0, z: 0, headingDeg: 0 },
      state: STATE,
      hookPoint: { x: 2, z: 10.5 },
    },
    {
      configurationId: 'CFG-2',
      placement: { x: 8, z: 0, headingDeg: 0 },
      state: { ...STATE, turretRotationDeg: -5 },
      hookPoint: { x: 6, z: 10.5 },
    },
  ],
}

const RESPONSE = {
  shares_kg: [2300, 2300],
  share_percent: [50, 50],
  evaluations: [REST_EVALUATED, REST_EVALUATED],
  tandem_ok: true,
  alerts: [
    {
      code: 'TANDEM_WITHIN_LIMIT',
      severity: 'INFO',
      message: 'Içamento em tandem dentro do limite de 75 % da capacidade de cada guindaste.',
    },
  ],
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('cliente REST do tandem', () => {
  it('envia o contrato em snake_case para /evaluations/tandem', async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => jsonResponse(RESPONSE))
    const client = createTandemRestClient({ fetchFn })

    await client.evaluate(INPUT)

    const [url, init] = fetchFn.mock.calls[0] ?? []
    expect(url).toBe(TANDEM_PATH)
    expect(init?.method).toBe('POST')
    expect(JSON.parse(String(init?.body))).toEqual({
      load_weight_kg: 4600,
      load_cg: { x: 4, z: 10.5 },
      cranes: [
        {
          configuration_id: 'CFG-1',
          placement: { x: 0, z: 0, heading_deg: 0 },
          state: {
            boom_length_m: 12,
            boom_angle_deg: 30,
            turret_rotation_deg: 5,
            cable_length_m: 6,
          },
          hook_point: { x: 2, z: 10.5 },
        },
        expect.objectContaining({ configuration_id: 'CFG-2', hook_point: { x: 6, z: 10.5 } }),
      ],
    })
  })

  it('lê a divisão, as duas avaliações e os alertas', async () => {
    const client = createTandemRestClient({
      fetchFn: vi.fn<typeof fetch>(async () => jsonResponse(RESPONSE)),
    })

    const result = await client.evaluate(INPUT)

    expect(result.sharesKg).toEqual([2300, 2300])
    expect(result.sharePercent).toEqual([50, 50])
    expect(result.tandemOk).toBe(true)
    expect(result.evaluations.map((item) => item.kind)).toEqual(['EVALUATED', 'EVALUATED'])
    expect(result.alerts[0]?.code).toBe('TANDEM_WITHIN_LIMIT')
  })

  it('traduz o 422 (pontos de içamento iguais) em erro com a mensagem do servidor', async () => {
    const client = createTandemRestClient({
      fetchFn: vi.fn<typeof fetch>(async () =>
        jsonResponse({ detail: 'Os dois pontos de içamento não podem coincidir.' }, 422),
      ),
    })

    const error = await client.evaluate(INPUT).catch((reason: unknown) => reason)

    expect(error).toBeInstanceOf(EvaluationClientError)
    expect((error as EvaluationClientError).message).toContain('não podem coincidir')
  })

  it('recusa uma resposta fora do contrato', () => {
    expect(() => mapTandemResponse({ ...RESPONSE, tandem_ok: 'sim' })).toThrow(/tandem_ok/)
    expect(() => mapTandemResponse({ ...RESPONSE, evaluations: [REST_EVALUATED] })).toThrow(
      /evaluations/,
    )
  })

  it('o corpo é o mesmo do contrato, sem campos a mais', () => {
    expect(Object.keys(toTandemRequestDto(INPUT)).sort()).toEqual([
      'cranes',
      'load_cg',
      'load_weight_kg',
    ])
  })

  it('manda o ambiente de cada guindaste e o vento comum, como na avaliação individual', () => {
    const [first, second] = INPUT.cranes
    const dto = toTandemRequestDto({
      ...INPUT,
      windSpeedMs: 11.8,
      cranes: [
        {
          ...first,
          outriggers: { extensionPercent: 50, jacksSet: false },
          groundSlopeDeg: 0.8,
          accessoryIds: ['ACC-MANILHA'],
          soilKinds: ['clay', 'clay', 'rock', 'rock'],
          obstacleConflicts: ['Poste'],
        },
        { ...second, outriggers: { extensionPercent: 100, jacksSet: true }, accessoryIds: [] },
      ],
    })

    expect(dto.wind_speed_ms).toBe(11.8)
    const cranes = dto.cranes as Record<string, unknown>[]
    expect(cranes[0]).toMatchObject({
      outriggers: { extension_percent: 50, jacks_set: false },
      ground_slope_deg: 0.8,
      accessory_ids: ['ACC-MANILHA'],
      soil_kinds: ['clay', 'clay', 'rock', 'rock'],
      obstacle_conflicts: ['Poste'],
    })
    // Lista vazia de acessórios não vai (o backend aceitaria, mas o corpo fica como antes).
    expect(Object.keys(cranes[1] ?? {}).sort()).toEqual([
      'configuration_id',
      'hook_point',
      'outriggers',
      'placement',
      'state',
    ])
  })
})

describe('cenário com guindastes adicionais e carga', () => {
  const SPEC: ScenarioSpec = {
    ...EMPTY_SCENARIO,
    cranes: [
      { id: 'extra-1', configurationId: 'CFG-2', placement: { x: 8, z: 0, headingDeg: 90 } },
    ],
    cargo: { x: 4, z: 10.5, rotationYDeg: 90 },
  }

  it('ida e volta pelo JSON do backend', () => {
    const dto = toScenarioSpecDto(SPEC)

    expect(dto.cranes).toEqual([
      {
        id: 'extra-1',
        configuration_id: 'CFG-2',
        placement: { x: 8, z: 0, heading_deg: 90 },
      },
    ])
    expect(dto.cargo).toEqual({ x: 4, z: 10.5, rotation_y_deg: 90 })
    expect(mapScenarioSpec(dto, 'spec')).toEqual(SPEC)
  })

  it('cenário antigo continua igual', () => {
    const dto = toScenarioSpecDto(EMPTY_SCENARIO)

    expect(dto).not.toHaveProperty('cranes')
    expect(dto).not.toHaveProperty('cargo')
    expect(mapScenarioSpec({ ...dto, cranes: null, cargo: null }, 'spec')).toEqual(EMPTY_SCENARIO)
  })
})
