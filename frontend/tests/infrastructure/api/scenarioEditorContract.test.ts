// Contrato do editor do ambiente (TASK-066): solo e vento no cenário salvo, e na avaliação.

import { describe, expect, it } from 'vitest'

import { buildEvaluationInput } from '../../../src/app/evaluationInput'
import { EMPTY_SCENARIO, type ScenarioSpec } from '../../../src/domain/environment/environment'
import { toEvaluationRequestDto } from '../../../src/infrastructure/api/evaluationContract'
import {
  mapScenarioSpec,
  toScenarioSpecDto,
} from '../../../src/infrastructure/api/scenarioRestClient'

const SPEC: ScenarioSpec = {
  ...EMPTY_SCENARIO,
  terrain: {
    slopeXPercent: 0,
    slopeZPercent: 0,
    features: [{ id: 'n1', kind: 'flatten', centerX: 1, centerZ: 2, radiusM: 5, heightM: -0.5 }],
  },
  soilZones: [{ id: 's1', kind: 'loose_fill', centerX: 3, centerZ: 4, radiusM: 2 }],
  wind: { speedMs: 7, directionDeg: 120 },
}

describe('cenário com solo, vento e nivelamento', () => {
  it('ida e volta pelo JSON do backend em snake_case', () => {
    const dto = toScenarioSpecDto(SPEC)
    expect(dto.soil_zones).toEqual([
      { id: 's1', kind: 'loose_fill', center_x: 3, center_z: 4, radius_m: 2 },
    ])
    expect(dto.wind).toEqual({ speed_ms: 7, direction_deg: 120 })
    expect(mapScenarioSpec(dto, 'spec')).toEqual(SPEC)
  })

  it('cenário antigo, sem solo nem vento, continua abrindo e salvando igual', () => {
    const dto = toScenarioSpecDto(EMPTY_SCENARIO)
    expect(dto).not.toHaveProperty('soil_zones')
    expect(dto).not.toHaveProperty('wind')
    expect(mapScenarioSpec({ ...dto, soil_zones: null, wind: null }, 'spec')).toEqual(
      EMPTY_SCENARIO,
    )
  })
})

describe('avaliação com o cenário', () => {
  const state = {
    turretRotationDeg: 0,
    boomAngleDeg: 45,
    boomLengthM: 12,
    cableLengthM: 5,
  }

  it('envia soil_kinds, wind_speed_ms e obstacle_conflicts só quando existem', () => {
    const plain = buildEvaluationInput(state, 'cfg', '1000')
    expect(plain.input && toEvaluationRequestDto(plain.input)).not.toHaveProperty('soil_kinds')

    const full = buildEvaluationInput(state, 'cfg', '1000', undefined, [], undefined, {
      soilKinds: ['rock', 'rock', 'clay', 'clay'],
      windSpeedMs: 9,
      obstacleConflicts: ['o1'],
    })
    expect(full.input && toEvaluationRequestDto(full.input)).toMatchObject({
      soil_kinds: ['rock', 'rock', 'clay', 'clay'],
      wind_speed_ms: 9,
      obstacle_conflicts: ['o1'],
    })

    const noConflicts = buildEvaluationInput(state, 'cfg', '1000', undefined, [], undefined, {
      obstacleConflicts: [],
    })
    expect(noConflicts.input && toEvaluationRequestDto(noConflicts.input)).not.toHaveProperty(
      'obstacle_conflicts',
    )
  })
})
