// Risco de tombamento e alertas nos clientes REST e WebSocket, e patolas e inclinação no pedido
// (TASK-055; RN-013), com respostas FICTÍCIAS.

import { describe, expect, it } from 'vitest'

import { toEvaluationRequestDto } from '../../src/infrastructure/api/evaluationContract'
import { mapEvaluationResponse } from '../../src/infrastructure/api/evaluationRestClient'
import {
  parseServerMessage,
  toStateChangedMessage,
} from '../../src/infrastructure/websocket/evaluationMessages'
import { FICTICIO_INPUT, REST_EVALUATED, wsEvaluated } from '../fixtures/evaluationResponses'

const SAFETY = {
  tipping_risk: 'HIGH',
  alerts: [
    {
      code: 'OUTRIGGERS_NOT_READY',
      severity: 'CRITICAL',
      message: 'Patolas a 50 % e apoiadas: a tabela exige patolas totalmente estendidas.',
    },
    {
      code: 'GROUND_SLOPE_NOT_INFORMED',
      severity: 'INFO',
      message: 'Inclinação do terreno não informada.',
    },
  ],
}

describe('risco de tombamento e alertas (TASK-055)', () => {
  it('REST: mapeia tipping_risk e alerts', () => {
    const result = mapEvaluationResponse({ ...REST_EVALUATED, ...SAFETY })

    expect(result.tippingRisk).toBe('HIGH')
    expect(result.alerts).toEqual([
      {
        code: 'OUTRIGGERS_NOT_READY',
        severity: 'CRITICAL',
        message: 'Patolas a 50 % e apoiadas: a tabela exige patolas totalmente estendidas.',
      },
      {
        code: 'GROUND_SLOPE_NOT_INFORMED',
        severity: 'INFO',
        message: 'Inclinação do terreno não informada.',
      },
    ])
  })

  it('WebSocket: mapeia tipping_risk e alerts do payload', () => {
    const message = wsEvaluated(4)
    const parsed = parseServerMessage(
      JSON.stringify({ ...message, payload: { ...message.payload, ...SAFETY } }),
    )

    expect(parsed.kind).toBe('evaluated')
    expect(parsed.kind === 'evaluated' && parsed.result.tippingRisk).toBe('HIGH')
    expect(parsed.kind === 'evaluated' && parsed.result.alerts).toHaveLength(2)
  })

  it('backend anterior: sem os campos, risco nulo e lista vazia', () => {
    const result = mapEvaluationResponse(REST_EVALUATED)

    expect(result.tippingRisk).toBeNull()
    expect(result.alerts).toEqual([])
  })

  it('recusa risco ou gravidade fora do contrato', () => {
    expect(() => mapEvaluationResponse({ ...REST_EVALUATED, tipping_risk: 'EXTREME' })).toThrow()
    expect(() =>
      mapEvaluationResponse({
        ...REST_EVALUATED,
        alerts: [{ code: 'X', severity: 'FATAL', message: 'x' }],
      }),
    ).toThrow()
  })

  it('o pedido leva patolas e inclinação só quando informados', () => {
    expect(toEvaluationRequestDto(FICTICIO_INPUT)).not.toHaveProperty('outriggers')
    expect(toEvaluationRequestDto(FICTICIO_INPUT)).not.toHaveProperty('ground_slope_deg')

    const input = {
      ...FICTICIO_INPUT,
      outriggers: { extensionPercent: 50, jacksSet: true },
      groundSlopeDeg: 0,
    }
    expect(toEvaluationRequestDto(input)).toMatchObject({
      outriggers: { extension_percent: 50, jacks_set: true },
      ground_slope_deg: 0,
    })
    expect(toStateChangedMessage(1, input).payload).toMatchObject({
      outriggers: { extension_percent: 50, jacks_set: true },
      ground_slope_deg: 0,
    })
  })
})
