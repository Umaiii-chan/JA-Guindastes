// Quando um guindaste só não atende e a tela recomenda dois (TASK-120; ADR-053). Dados FICTÍCIOS.

import { describe, expect, it } from 'vitest'

import { singleCraneShortfall } from '../../../src/application/planning/singleCraneShortfall'
import { mapEvaluationResponse } from '../../../src/infrastructure/api/evaluationRestClient'
import { REST_EVALUATED, REST_NOT_EVALUABLE } from '../../fixtures/evaluationResponses'

const notEvaluable = (...codes: string[]) =>
  mapEvaluationResponse({
    ...REST_NOT_EVALUABLE,
    reasons: codes.map((code) => ({ code, category: 'CAPACITY' })),
  })

describe('singleCraneShortfall', () => {
  it('sem resultado ainda, não recomenda nada', () => {
    expect(singleCraneShortfall(null)).toBeNull()
  })

  it('avaliado dentro da capacidade: um guindaste atende', () => {
    expect(singleCraneShortfall(mapEvaluationResponse(REST_EVALUATED))).toBeNull()
  })

  it('avaliado com a utilização acima de 100 %: recomenda dois guindastes', () => {
    const result = mapEvaluationResponse({ ...REST_EVALUATED, utilization_percent: 130 })
    expect(singleCraneShortfall(result)?.kind).toBe('over-capacity')
  })

  it('exatamente 100 % ainda atende', () => {
    expect(
      singleCraneShortfall(mapEvaluationResponse({ ...REST_EVALUATED, utilization_percent: 100 })),
    ).toBeNull()
  })

  it.each(['RADIUS_ABOVE_CHART_MAX', 'BOOM_LENGTH_ABOVE_CHART_MAX', 'POINT_NOT_IN_CHART'])(
    'não avaliável por %s (além da tabela): recomenda dois guindastes',
    (code) => {
      expect(singleCraneShortfall(notEvaluable(code))?.kind).toBe('outside-chart')
    },
  )

  it.each([
    'CRANE_GEOMETRY_NOT_FOUND',
    'ACTIVE_LOAD_CHART_NOT_FOUND',
    'ACCESSORY_NOT_FOUND',
    'OUTSIDE_GEOMETRIC_DOMAIN',
    'BOOM_ANGLE_ABOVE_MAX',
    'RADIUS_BELOW_CHART_MIN',
  ])('não avaliável por %s: dois guindastes não resolvem, não recomenda', (code) => {
    expect(singleCraneShortfall(notEvaluable(code))).toBeNull()
  })

  it('com um motivo além da tabela entre outros, recomenda', () => {
    expect(
      singleCraneShortfall(notEvaluable('ACCESSORY_NOT_FOUND', 'RADIUS_ABOVE_CHART_MAX')),
    ).not.toBeNull()
  })
})
