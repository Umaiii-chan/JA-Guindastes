// `stability` da avaliação nos clientes REST e WebSocket, e `load_wind_area_m2` na requisição
// (TASK-106; RN-017; ADR-050). FICTÍCIO.

import { describe, expect, it } from 'vitest'

import { buildEvaluationInput } from '../../../src/app/evaluationInput'
import { toEvaluationRequestDto } from '../../../src/infrastructure/api/evaluationContract'
import { mapEvaluationResponse } from '../../../src/infrastructure/api/evaluationRestClient'
import { parseServerMessage } from '../../../src/infrastructure/websocket/evaluationMessages'
import { REST_EVALUATED, wsEvaluated } from '../../fixtures/evaluationResponses'

const STABILITY_DTO = {
  tipping_ratio_percent: 38.855,
  critical_edge: 'dianteira',
  tipped: false,
  pad_reactions_kg: [14575.2, 14575.2, 5424.8, 5424.8],
  worst_pad_share: 0.3644,
  deflection_m: 0.0256,
  pad_half_span_m: 3.8,
  wind_limit_ms: 9,
  wind_force_n: 0,
}

const STABILITY = {
  tippingRatioPercent: 38.855,
  criticalEdge: 'dianteira',
  tipped: false,
  padReactionsKg: [14575.2, 14575.2, 5424.8, 5424.8],
  worstPadShare: 0.3644,
  deflectionM: 0.0256,
  padHalfSpanM: 3.8,
  windLimitMs: 9,
  windForceN: 0,
}

describe('stability no cliente REST', () => {
  it('mapeia a estática para stability', () => {
    const result = mapEvaluationResponse({ ...REST_EVALUATED, stability: STABILITY_DTO })

    expect(result.stability).toEqual(STABILITY)
  })

  it('ausente ou null: o resultado fica sem stability (backend anterior ou sem geometria)', () => {
    expect('stability' in mapEvaluationResponse(REST_EVALUATED)).toBe(false)
    expect('stability' in mapEvaluationResponse({ ...REST_EVALUATED, stability: null })).toBe(false)
  })

  it('recusa reações que não são 4 números e campo faltando', () => {
    expect(() =>
      mapEvaluationResponse({
        ...REST_EVALUATED,
        stability: { ...STABILITY_DTO, pad_reactions_kg: [1, 2, 3] },
      }),
    ).toThrow(/stability.pad_reactions_kg/)
    expect(() =>
      mapEvaluationResponse({
        ...REST_EVALUATED,
        stability: { ...STABILITY_DTO, wind_limit_ms: undefined },
      }),
    ).toThrow(/wind_limit_ms/)
    expect(() =>
      mapEvaluationResponse({
        ...REST_EVALUATED,
        stability: { ...STABILITY_DTO, tipped: 'não' },
      }),
    ).toThrow(/stability.tipped/)
  })
})

describe('stability no cliente WebSocket', () => {
  it('mapeia a estática do payload de simulation.evaluated', () => {
    const message = wsEvaluated(7)
    const raw = JSON.stringify({
      ...message,
      payload: { ...message.payload, stability: STABILITY_DTO },
    })

    const parsed = parseServerMessage(raw)

    expect(parsed.kind === 'evaluated' && parsed.result.stability).toEqual(STABILITY)
  })
})

describe('load_wind_area_m2 na requisição', () => {
  const craneState = {
    boomLengthM: 20,
    boomAngleDeg: 30,
    turretRotationDeg: 0,
    cableLengthM: 1,
  } as Parameters<typeof buildEvaluationInput>[0]

  it('vai ao backend só quando informada', () => {
    const plain = buildEvaluationInput(craneState, 'CFG', '1500')
    const windy = buildEvaluationInput(craneState, 'CFG', '1500', undefined, [], undefined, {
      windSpeedMs: 5,
      loadWindAreaM2: 7.2,
    })

    expect(plain.input && toEvaluationRequestDto(plain.input)).not.toHaveProperty(
      'load_wind_area_m2',
    )
    expect(windy.input && toEvaluationRequestDto(windy.input)).toMatchObject({
      wind_speed_ms: 5,
      load_wind_area_m2: 7.2,
    })
  })
})
