// Contrato da rede elétrica e do içamento crítico na avaliação (TASK-107; ADR-051): o `site` do pedido
// (REST e WebSocket), `power_lines` e `critical_lift` da resposta, e o cenário com redes.

import { describe, expect, it } from 'vitest'

import { buildEvaluationInput, buildEvaluationSite } from '../../../src/app/evaluationInput'
import { EMPTY_SCENARIO, type ScenarioSpec } from '../../../src/domain/environment/environment'
import type { PowerLine } from '../../../src/domain/environment/powerLine'
import { toEvaluationRequestDto } from '../../../src/infrastructure/api/evaluationContract'
import { mapEvaluationResponse } from '../../../src/infrastructure/api/evaluationRestClient'
import {
  mapScenarioSpec,
  toScenarioSpecDto,
} from '../../../src/infrastructure/api/scenarioRestClient'
import {
  parseServerMessage,
  toStateChangedMessage,
} from '../../../src/infrastructure/websocket/evaluationMessages'
import { FICTICIO_INPUT, REST_EVALUATED, wsEvaluated } from '../../fixtures/evaluationResponses'

const LINE: PowerLine = {
  id: 'rede-1',
  label: 'Rede FICTÍCIA',
  x1M: -10,
  z1M: 18.8,
  x2M: 10,
  z2M: 18.8,
  heightM: 13.5,
  voltageKv: 138,
}
const SPEC: ScenarioSpec = {
  ...EMPTY_SCENARIO,
  crane: { x: 3, z: -2, headingDeg: 90 },
  powerLines: [LINE],
}

const CLEARANCE = {
  line_id: 'rede-1',
  label: 'Rede FICTÍCIA',
  voltage_kv: 138,
  required_m: 3.94,
  distance_m: 1.02,
  swept_distance_m: 0.98,
  status: 'VIOLATION',
  swept_status: 'VIOLATION',
  nearest_part: 'boom',
}
const CRITICAL = {
  is_critical: true,
  triggers: [{ code: 'POWER_LINE_CLOSE', message: 'distância à rede a 0,25× a mínima' }],
  plan_items: ['Plano de içamento escrito, assinado pelo responsável técnico'],
}

describe('cenário com rede elétrica', () => {
  it('ida e volta pelo JSON do backend em snake_case', () => {
    const dto = toScenarioSpecDto(SPEC)
    expect(dto.power_lines).toEqual([
      {
        id: 'rede-1',
        label: 'Rede FICTÍCIA',
        x1_m: -10,
        z1_m: 18.8,
        x2_m: 10,
        z2_m: 18.8,
        height_m: 13.5,
        voltage_kv: 138,
      },
    ])
    expect(mapScenarioSpec(dto, 'spec')).toEqual(SPEC)
  })

  it('cenário antigo, sem rede, continua abrindo e salvando igual', () => {
    const dto = toScenarioSpecDto(EMPTY_SCENARIO)
    expect(dto).not.toHaveProperty('power_lines')
    expect(mapScenarioSpec({ ...dto, power_lines: null }, 'spec')).toEqual(EMPTY_SCENARIO)
  })
})

describe('o site do pedido de avaliação', () => {
  const site = buildEvaluationSite({
    spec: SPEC,
    load: { lengthM: 3, widthM: 2, heightM: 1.5 },
    tandem: false,
    loadOverOccupied: true,
  })
  const input = { ...FICTICIO_INPUT, site }

  it('monta o local: redes, posição do guindaste, carga e contexto do içamento', () => {
    expect(site).toEqual({
      powerLines: [LINE],
      craneXM: 3,
      craneZM: -2,
      craneHeadingDeg: 90,
      loadLengthM: 3,
      loadWidthM: 2,
      loadHeightM: 1.5,
      tandem: false,
      loadOverOccupied: true,
    })
  })

  it('sem carga válida não manda as medidas; sem rede manda lista vazia (o içamento ainda é classificado)', () => {
    const empty = buildEvaluationSite({
      spec: EMPTY_SCENARIO,
      load: null,
      tandem: true,
      loadOverOccupied: false,
    })
    expect(empty.powerLines).toEqual([])
    expect(empty).not.toHaveProperty('loadLengthM')
    expect(empty.tandem).toBe(true)
  })

  it('o REST manda o site em snake_case', () => {
    expect(toEvaluationRequestDto(input).site).toEqual({
      power_lines: [
        {
          id: 'rede-1',
          label: 'Rede FICTÍCIA',
          x1_m: -10,
          z1_m: 18.8,
          x2_m: 10,
          z2_m: 18.8,
          height_m: 13.5,
          voltage_kv: 138,
        },
      ],
      crane_x_m: 3,
      crane_z_m: -2,
      crane_heading_deg: 90,
      load_length_m: 3,
      load_width_m: 2,
      load_height_m: 1.5,
      tandem: false,
      load_over_occupied: true,
    })
  })

  it('o WebSocket manda o mesmo site no payload', () => {
    const message = toStateChangedMessage(5, input)
    expect(message.payload.site).toEqual(toEvaluationRequestDto(input).site)
  })

  it('sem site, o pedido é o de antes', () => {
    expect(toEvaluationRequestDto(FICTICIO_INPUT)).not.toHaveProperty('site')
    expect(toStateChangedMessage(1, FICTICIO_INPUT).payload).not.toHaveProperty('site')
  })

  it('buildEvaluationInput leva o site dos extras ao pedido', () => {
    const result = buildEvaluationInput(
      { turretRotationDeg: 0, boomAngleDeg: 30, boomLengthM: 20, cableLengthM: 1 } as never,
      'CFG-1',
      '1500',
      undefined,
      [],
      undefined,
      { site },
    )
    expect(result.input?.site).toEqual(site)
  })
})

describe('a resposta com rede e içamento crítico', () => {
  const rest = { ...REST_EVALUATED, power_lines: [CLEARANCE], critical_lift: CRITICAL }

  it('REST: mapeia as distâncias e a classificação', () => {
    const result = mapEvaluationResponse(rest)

    expect(result.powerLines).toEqual([
      {
        lineId: 'rede-1',
        label: 'Rede FICTÍCIA',
        voltageKv: 138,
        requiredM: 3.94,
        distanceM: 1.02,
        sweptDistanceM: 0.98,
        status: 'VIOLATION',
        sweptStatus: 'VIOLATION',
        nearestPart: 'boom',
      },
    ])
    expect(result.criticalLift).toEqual({
      isCritical: true,
      triggers: [{ code: 'POWER_LINE_CLOSE', message: 'distância à rede a 0,25× a mínima' }],
      planItems: ['Plano de içamento escrito, assinado pelo responsável técnico'],
    })
  })

  it('WebSocket: o mesmo mapeamento', () => {
    const message = wsEvaluated(3)
    const text = JSON.stringify({
      ...message,
      payload: { ...message.payload, power_lines: [CLEARANCE], critical_lift: CRITICAL },
    })
    const parsed = parseServerMessage(text)

    expect(parsed.kind).toBe('evaluated')
    if (parsed.kind !== 'evaluated') return
    expect(parsed.result.powerLines?.[0]?.status).toBe('VIOLATION')
    expect(parsed.result.criticalLift?.isCritical).toBe(true)
  })

  it('resposta sem site (lista vazia e null): sem rede e sem classificação', () => {
    const result = mapEvaluationResponse({
      ...REST_EVALUATED,
      power_lines: [],
      critical_lift: null,
    })
    expect(result.powerLines).toEqual([])
    expect(result.criticalLift).toBeUndefined()
  })

  it('resposta antiga, sem os campos, continua igual', () => {
    const result = mapEvaluationResponse(REST_EVALUATED)
    expect(result).not.toHaveProperty('powerLines')
    expect(result).not.toHaveProperty('criticalLift')
  })

  it('recusa status, parte e flag fora do contrato', () => {
    expect(() =>
      mapEvaluationResponse({ ...rest, power_lines: [{ ...CLEARANCE, status: 'PERIGO' }] }),
    ).toThrow(/status/)
    expect(() =>
      mapEvaluationResponse({ ...rest, power_lines: [{ ...CLEARANCE, nearest_part: 'torre' }] }),
    ).toThrow(/nearest_part/)
    expect(() =>
      mapEvaluationResponse({ ...rest, critical_lift: { ...CRITICAL, is_critical: 'sim' } }),
    ).toThrow(/is_critical/)
  })
})
