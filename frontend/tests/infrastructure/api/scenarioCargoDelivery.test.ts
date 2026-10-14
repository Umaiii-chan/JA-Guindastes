// Carga e entrega no cenário salvo (contrato da leva F; TASK-076): ida e volta do JSON.

import { describe, expect, it } from 'vitest'

import { EMPTY_SCENARIO } from '../../../src/domain/environment/environment'
import {
  mapScenarioSpec,
  toScenarioSpecDto,
} from '../../../src/infrastructure/api/scenarioRestClient'

describe('cargo e delivery no cenário', () => {
  it('vão e voltam em snake_case', () => {
    const spec = {
      ...EMPTY_SCENARIO,
      cargo: { x: 12, z: -1, rotationYDeg: 15 },
      delivery: { x: -8, z: 2, rotationYDeg: 90, radiusM: 3 },
    }

    const dto = toScenarioSpecDto(spec)

    expect(dto.cargo).toEqual({ x: 12, z: -1, rotation_y_deg: 15 })
    expect(dto.delivery).toEqual({ x: -8, z: 2, rotation_y_deg: 90, radius_m: 3 })
    expect(mapScenarioSpec(dto, 'spec')).toEqual(spec)
  })

  it('cenários antigos não ganham os campos', () => {
    const dto = toScenarioSpecDto(EMPTY_SCENARIO)

    expect(dto).not.toHaveProperty('cargo')
    expect(dto).not.toHaveProperty('delivery')
    const mapped = mapScenarioSpec({ ...dto, cargo: null, delivery: null }, 'spec')
    expect(mapped.cargo).toBeUndefined()
    expect(mapped.delivery).toBeUndefined()
  })
})
