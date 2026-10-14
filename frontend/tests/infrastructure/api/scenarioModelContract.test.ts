// Cenário com objetos da biblioteca no contrato do backend (TASK-072; ADR-036): `kind: "model"` e
// `model_id`. Dados FICTÍCIOS.

import { describe, expect, it } from 'vitest'

import { EMPTY_SCENARIO, type ScenarioSpec } from '../../../src/domain/environment/environment'
import {
  mapScenarioSpec,
  toScenarioSpecDto,
} from '../../../src/infrastructure/api/scenarioRestClient'

const SPEC: ScenarioSpec = {
  ...EMPTY_SCENARIO,
  obstacles: [
    {
      id: 'barracao-aberto-1',
      label: 'Barracão FICTÍCIO',
      kind: 'model',
      modelId: 'barracao-aberto',
      centerX: 4,
      centerZ: 22,
      widthM: 14,
      depthM: 18,
      heightM: 8.8,
      rotationYDeg: 180,
    },
    {
      id: 'box-1',
      label: 'Caixa',
      kind: 'box',
      centerX: 0,
      centerZ: 0,
      widthM: 1,
      depthM: 1,
      heightM: 1,
      rotationYDeg: 0,
    },
  ],
}

describe('objeto da biblioteca no JSON do backend', () => {
  it('ida e volta com kind model e model_id; caixa não leva model_id', () => {
    const dto = toScenarioSpecDto(SPEC) as { obstacles: Record<string, unknown>[] }
    expect(dto.obstacles[0]).toMatchObject({ kind: 'model', model_id: 'barracao-aberto' })
    expect(dto.obstacles[1]).not.toHaveProperty('model_id')
    expect(mapScenarioSpec(dto, 'spec')).toEqual(SPEC)
  })

  it('aceita model_id nulo (resposta do backend para caixa e cilindro)', () => {
    const dto = toScenarioSpecDto(SPEC) as { obstacles: Record<string, unknown>[] }
    const withNull = {
      ...dto,
      obstacles: [dto.obstacles[0], { ...dto.obstacles[1], model_id: null }],
    }
    expect(mapScenarioSpec(withNull, 'spec')).toEqual(SPEC)
  })
})
