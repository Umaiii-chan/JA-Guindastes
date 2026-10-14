// Situação do resultado do backend (TASK-039; TASK-051: usa o nível do limite do modelo). FICTÍCIO.

import { describe, expect, it } from 'vitest'

import { evaluationStatus } from '../../../src/application/evaluation/evaluationStatus'
import type {
  CapacityLimitResult,
  EvaluatedResult,
  EvaluationResult,
} from '../../../src/domain/evaluation/evaluation'

function evaluated(
  utilizationPercent: number,
  capacityLimit?: Partial<CapacityLimitResult>,
): EvaluationResult {
  const result: EvaluatedResult = {
    kind: 'EVALUATED',
    workingRadiusM: 10,
    hookHeightM: 5,
    capacity: { maximumCapacityKg: 1000, strategy: null, queriedRadiusM: null, usedPoint: null },
    utilizationPercent,
    loadChartId: 'LC',
    loadChartVersion: 'v1',
    rotationZoneCode: null,
    rotationZoneName: null,
    hookBlockWeightKg: null,
    comparedWeightKg: null,
    ...(capacityLimit && {
      capacityLimit: {
        limitPercent: 85,
        effectiveCapacityKg: 850,
        limitUtilizationPercent: utilizationPercent,
        warningBandPercent: 90,
        level: 'OK',
        ...capacityLimit,
      },
    }),
  }
  return result
}

describe('evaluationStatus', () => {
  it('sem capacityLimit: ok até 100 % e over acima (regra anterior)', () => {
    expect(evaluationStatus(evaluated(95))).toBe('ok')
    expect(evaluationStatus(evaluated(100))).toBe('ok')
    expect(evaluationStatus(evaluated(101))).toBe('over')
  })

  it('com capacityLimit: usa o level do servidor, não a utilização contra a tabela', () => {
    expect(evaluationStatus(evaluated(50, { level: 'OK' }))).toBe('ok')
    expect(evaluationStatus(evaluated(50, { level: 'WARNING' }))).toBe('warning')
    // Abaixo de 100 % da tabela, mas acima do limite do modelo.
    expect(evaluationStatus(evaluated(90, { level: 'OVER' }))).toBe('over')
  })

  it('sem resultado, não avaliável ou utilização não finita: unknown', () => {
    expect(evaluationStatus(null)).toBe('unknown')
    expect(evaluationStatus(evaluated(Number.NaN, { level: 'OK' }))).toBe('unknown')
    expect(
      evaluationStatus({
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
        reasons: [],
      }),
    ).toBe('unknown')
  })
})
