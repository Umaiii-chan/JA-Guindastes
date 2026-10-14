// `capacity_limit` da avaliação nos clientes REST e WebSocket (TASK-051; RN-011). FICTÍCIO.

import { describe, expect, it } from 'vitest'

import { mapEvaluationResponse } from '../../../src/infrastructure/api/evaluationRestClient'
import { parseServerMessage } from '../../../src/infrastructure/websocket/evaluationMessages'
import { REST_EVALUATED, REST_NOT_EVALUABLE, wsEvaluated } from '../../fixtures/evaluationResponses'

const LIMIT_DTO = {
  limit_percent: 85,
  effective_capacity_kg: 1700,
  limit_utilization_percent: 88.2353,
  warning_band_percent: 90,
  level: 'OK',
}

const LIMIT = {
  limitPercent: 85,
  effectiveCapacityKg: 1700,
  limitUtilizationPercent: 88.2353,
  warningBandPercent: 90,
  level: 'OK',
}

describe('capacity_limit no cliente REST', () => {
  it('mapeia o limite para capacityLimit', () => {
    const result = mapEvaluationResponse({ ...REST_EVALUATED, capacity_limit: LIMIT_DTO })

    expect(result.capacityLimit).toEqual(LIMIT)
  })

  it('aceita cada nível', () => {
    for (const level of ['OK', 'WARNING', 'OVER']) {
      const result = mapEvaluationResponse({
        ...REST_EVALUATED,
        capacity_limit: { ...LIMIT_DTO, level },
      })
      expect(result.capacityLimit?.level).toBe(level)
    }
  })

  it('ausente ou null: o resultado fica sem capacityLimit (backend anterior ou não avaliável)', () => {
    expect('capacityLimit' in mapEvaluationResponse(REST_EVALUATED)).toBe(false)
    expect(
      'capacityLimit' in mapEvaluationResponse({ ...REST_EVALUATED, capacity_limit: null }),
    ).toBe(false)
    expect(
      'capacityLimit' in mapEvaluationResponse({ ...REST_NOT_EVALUABLE, capacity_limit: null }),
    ).toBe(false)
  })

  it('recusa nível desconhecido e campo faltando como violação do contrato', () => {
    expect(() =>
      mapEvaluationResponse({
        ...REST_EVALUATED,
        capacity_limit: { ...LIMIT_DTO, level: 'CRITICAL' },
      }),
    ).toThrow(/capacity_limit.level/)
    expect(() =>
      mapEvaluationResponse({
        ...REST_EVALUATED,
        capacity_limit: { ...LIMIT_DTO, effective_capacity_kg: undefined },
      }),
    ).toThrow(/effective_capacity_kg/)
  })
})

describe('capacity_limit no cliente WebSocket', () => {
  it('mapeia o limite do payload de simulation.evaluated', () => {
    const message = wsEvaluated(5)
    const raw = JSON.stringify({
      ...message,
      payload: { ...message.payload, capacity_limit: LIMIT_DTO },
    })

    const parsed = parseServerMessage(raw)

    expect(parsed).toMatchObject({ kind: 'evaluated', sequence: 5 })
    expect(parsed.kind === 'evaluated' && parsed.result.capacityLimit).toEqual(LIMIT)
  })

  it('sem capacity_limit, o resultado não tem capacityLimit', () => {
    const parsed = parseServerMessage(JSON.stringify(wsEvaluated(6)))

    expect(parsed.kind === 'evaluated' && 'capacityLimit' in parsed.result).toBe(false)
  })
})
