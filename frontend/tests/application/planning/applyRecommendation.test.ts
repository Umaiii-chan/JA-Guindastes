// Aplicar a recomendação ao cenário (TASK-075 com TASK-074). Dados FICTÍCIOS (ADR-012).

import { describe, expect, it } from 'vitest'

import {
  applyRecommendationToScenario,
  PLANNED_SECOND_CRANE_ID,
} from '../../../src/application/planning/applyRecommendation'
import { EMPTY_SCENARIO, type ScenarioSpec } from '../../../src/domain/environment/environment'
import type { PlanCraneDetail, PlanRecommendation } from '../../../src/domain/planning/planning'

function detail(configurationId: string): PlanCraneDetail {
  return {
    configurationId,
    manufacturerId: 'fab-ficticio',
    craneId: 'guindaste-ficticio',
    label: 'Guindaste FICTÍCIO',
    shareKg: 1500,
    boomLengthM: 20,
    boomAnglePickDeg: 60,
    boomAngleDeliveryDeg: 60,
    pickRadiusM: 8,
    deliveryRadiusM: 8,
    swingDeg: 90,
    utilizationPercent: 40,
    transportHeightM: 5,
    crossedObstacleIds: [],
  }
}

function recommendation(kind: 'single' | 'tandem'): PlanRecommendation {
  const tandem = kind === 'tandem'
  return {
    kind,
    configurationIds: tandem ? ['conf-a', 'conf-b'] : ['conf-a'],
    placements: tandem
      ? [
          { x: 1, z: 2, headingDeg: 30 },
          { x: 9, z: 2, headingDeg: 30 },
        ]
      : [{ x: 1, z: 2, headingDeg: 30 }],
    maxLimitUtilizationPercent: 40,
    tippingRisk: 'LOW',
    valid: true,
    summary: 'FICTÍCIO',
    trajectory: [],
    notes: [],
    details: tandem ? [detail('conf-a'), detail('conf-b')] : [detail('conf-a')],
  }
}

describe('aplicar a recomendação ao cenário', () => {
  it('um guindaste só: move o Guindaste 1 e não mexe nos adicionais', () => {
    const next = applyRecommendationToScenario(EMPTY_SCENARIO, recommendation('single'))
    expect(next.crane).toEqual({ x: 1, z: 2, headingDeg: 30 })
    expect(next.cranes).toBeUndefined()
  })

  it('tandem sem adicional: cria o Guindaste 2 com a configuração e a posição recomendadas', () => {
    const next = applyRecommendationToScenario(EMPTY_SCENARIO, recommendation('tandem'))
    expect(next.cranes).toEqual([
      {
        id: PLANNED_SECOND_CRANE_ID,
        configurationId: 'conf-b',
        placement: { x: 9, z: 2, headingDeg: 30 },
      },
    ])
  })

  it('tandem com adicionais: troca o primeiro adicional e mantém os outros', () => {
    const spec: ScenarioSpec = {
      ...EMPTY_SCENARIO,
      cranes: [
        { id: 'extra-7', configurationId: 'velha', placement: { x: 0, z: 0, headingDeg: 0 } },
        { id: 'extra-8', configurationId: 'outra', placement: { x: 5, z: 5, headingDeg: 0 } },
      ],
    }
    const next = applyRecommendationToScenario(spec, recommendation('tandem'))
    expect(next.cranes?.map((item) => [item.id, item.configurationId])).toEqual([
      ['extra-7', 'conf-b'],
      ['extra-8', 'outra'],
    ])
  })
})
