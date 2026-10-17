import { describe, expect, it } from 'vitest'

import { EMPTY_SCENARIO } from '../../src/domain/environment/environment'
import type { PlanningRequest } from '../../src/domain/planning/planning'
import { defaultGeometry } from '../../src/domain/rigging/slingGeometry'
import {
  createPlanningRestClient,
  mapPlanningResponse,
  PLANNING_PATH,
  toPlanningDto,
} from '../../src/infrastructure/api/planningRestClient'

// FICTÍCIO: resposta de exemplo no formato do backend (`POST /api/v1/planning/recommend`).
const RESPONSE = {
  recommendations: [
    {
      kind: 'single',
      configuration_ids: ['CFG-1'],
      placements: [{ x: 1, z: -6, heading_deg: 90 }],
      max_limit_utilization_percent: 49.4,
      tipping_risk: 'ATTENTION',
      valid: true,
      summary: '49 % do limite',
      trajectory: [
        {
          t_s: 0,
          crane_index: 0,
          state: {
            boom_length_m: 12,
            boom_angle_deg: 75,
            turret_rotation_deg: -51,
            cable_length_m: 1,
          },
          phase: 'aproximar',
        },
      ],
      notes: ['Posição do guindaste: X 1,0 m'],
      details: [
        {
          configuration_id: 'CFG-1',
          manufacturer_id: 'M-1',
          crane_id: 'C-1',
          label: 'Fabricante · Modelo · Configuração',
          share_kg: 2000,
          boom_length_m: 12,
          boom_angle_pick_deg: 40,
          boom_angle_delivery_deg: 40,
          pick_radius_m: 9.6,
          delivery_radius_m: 9.6,
          swing_deg: 103,
          utilization_percent: 49.4,
          transport_height_m: 4,
          crossed_obstacle_ids: ['OBS-1'],
          // Carga 3 × 1,5 m, lingas a 60° (geometria única: r = 1,677 m; queda = r·tan 60°).
          sling_length_m: 3.354102,
          sling_angle_deg: 60,
          sling_drop_m: 2.904738,
        },
      ],
    },
  ],
  notes: [],
}

const REQUEST: PlanningRequest = {
  load: { weightKg: 2000, lengthM: 3, widthM: 1.5, heightM: 1.2 },
  pick: { x: -7.5, z: 0, rotationYDeg: 0 },
  delivery: { x: 7.5, z: 0, rotationYDeg: 90 },
  scenario: {
    ...EMPTY_SCENARIO,
    cargo: { x: -7.5, z: 0, rotationYDeg: 0 },
    delivery: { x: 7.5, z: 0, rotationYDeg: 90, radiusM: 1.5 },
  },
  accessoryIds: ['ACC-1'],
  hookAttachM: 1.9,
}

describe('cliente do planejamento', () => {
  it('converte a resposta do backend para o domínio', () => {
    const result = mapPlanningResponse(RESPONSE)

    const best = result.recommendations[0]!
    expect(best.kind).toBe('single')
    expect(best.placements[0]).toEqual({ x: 1, z: -6, headingDeg: 90 })
    expect(best.tippingRisk).toBe('ATTENTION')
    expect(best.trajectory[0]?.state.turretRotationDeg).toBe(-51)
    expect(best.details[0]).toMatchObject({
      manufacturerId: 'M-1',
      craneId: 'C-1',
      pickRadiusM: 9.6,
      crossedObstacleIds: ['OBS-1'],
      slingAngleDeg: 60,
    })
  })

  it('as lingas do plano são as da geometria única da cena (F-19): plano x cena sem divergência', () => {
    const detail = mapPlanningResponse(RESPONSE).recommendations[0]!.details[0]!
    const scene = defaultGeometry(REQUEST.load.lengthM, REQUEST.load.widthM)

    expect(detail.slingDropM).toBeCloseTo(scene.dropM, 5)
    expect(detail.slingLengthM).toBeCloseTo(scene.lengthM, 5)
    expect(detail.slingAngleDeg).toBeCloseTo(scene.angleDeg, 5)
  })

  it('manda o ângulo das lingas ao backend só quando informado', () => {
    expect(toPlanningDto(REQUEST)).not.toHaveProperty('sling_angle_deg')
    expect(toPlanningDto({ ...REQUEST, slingAngleDeg: 45 })).toMatchObject({
      sling_angle_deg: 45,
    })
  })

  it('lê o aviso de busca cortada pelo tempo (TASK-089)', () => {
    expect(mapPlanningResponse(RESPONSE).timedOut).toBe(false)
    expect(mapPlanningResponse({ ...RESPONSE, timed_out: true }).timedOut).toBe(true)
    expect(mapPlanningResponse({ ...RESPONSE, timed_out: false }).timedOut).toBe(false)
    expect(() => mapPlanningResponse({ ...RESPONSE, timed_out: 'sim' })).toThrow(/timed_out/)
  })

  it('manda o centro de gravidade da carga quando a tela tem um (TASK-089)', () => {
    const withCg = toPlanningDto({ ...REQUEST, load: { ...REQUEST.load, cgOffsetM: -0.8 } }) as {
      load: unknown
    }

    expect(withCg.load).toEqual({
      weight_kg: 2000,
      length_m: 3,
      width_m: 1.5,
      height_m: 1.2,
      cg_offset_m: -0.8,
    })
  })

  it('resposta fora do contrato vira erro com o caminho do campo', () => {
    const broken = structuredClone(RESPONSE) as { recommendations: { kind: string }[] }
    broken.recommendations[0]!.kind = 'triple'

    expect(() => mapPlanningResponse(broken)).toThrow(/recommendations\[0\]\.kind/)
    expect(() => mapPlanningResponse({ notes: [] })).toThrow(/recommendations/)
  })

  it('monta o pedido em snake_case, com cenário, acessórios e a medida do gancho', () => {
    const dto = toPlanningDto(REQUEST) as {
      load: unknown
      delivery: unknown
      scenario: { cargo: unknown; delivery: { radius_m: number } }
      accessory_ids: unknown
      hook_attach_m: unknown
    }

    expect(dto.load).toEqual({ weight_kg: 2000, length_m: 3, width_m: 1.5, height_m: 1.2 })
    expect(dto.delivery).toEqual({ x: 7.5, z: 0, rotation_y_deg: 90 })
    expect(dto.scenario.cargo).toEqual({ x: -7.5, z: 0, rotation_y_deg: 0 })
    expect(dto.scenario.delivery.radius_m).toBe(1.5)
    expect(dto.accessory_ids).toEqual(['ACC-1'])
    expect(dto.hook_attach_m).toBe(1.9)
  })

  it('faz POST na rota do planejamento e devolve a recomendação', async () => {
    let called: { url: string; method: string | undefined } | null = null
    const fetchFn = ((url: string, init?: RequestInit) => {
      called = { url, method: init?.method }
      return Promise.resolve(
        new Response(JSON.stringify(RESPONSE), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    }) as typeof fetch

    const result = await createPlanningRestClient({ fetchFn }).recommend(REQUEST)

    expect(called).toEqual({ url: PLANNING_PATH, method: 'POST' })
    expect(result.recommendations).toHaveLength(1)
  })

  it('422 e falha de rede viram mensagens para a tela', async () => {
    const unprocessable = (() =>
      Promise.resolve(
        new Response(JSON.stringify({ detail: 'acessório não encontrado' }), { status: 422 }),
      )) as typeof fetch
    const offline = (() => Promise.reject(new TypeError('offline'))) as typeof fetch

    await expect(
      createPlanningRestClient({ fetchFn: unprocessable }).recommend(REQUEST),
    ).rejects.toThrow(/acessório não encontrado/)
    await expect(createPlanningRestClient({ fetchFn: offline }).recommend(REQUEST)).rejects.toThrow(
      /falha de rede/,
    )
  })
})
