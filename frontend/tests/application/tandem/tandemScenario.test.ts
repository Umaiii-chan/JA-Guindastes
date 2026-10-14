import { describe, expect, it } from 'vitest'

import {
  EMPTY_SCENARIO,
  MAX_EXTRA_CRANES,
  type ScenarioSpec,
} from '../../../src/domain/environment/environment'
import {
  addExtraCrane,
  canAddExtraCrane,
  DEFAULT_CRANE_SPACING_M,
  defaultCargoBetween,
} from '../../../src/application/tandem/tandemScenario'

describe('tandemScenario', () => {
  it('põe o guindaste novo à frente do principal, virado para ele', () => {
    const { spec, id } = addExtraCrane(EMPTY_SCENARIO, 'conf-1')

    expect(id).toBe('extra-1')
    expect(spec.cranes).toEqual([
      {
        id: 'extra-1',
        configurationId: 'conf-1',
        placement: { x: 0, z: DEFAULT_CRANE_SPACING_M, headingDeg: -180 },
      },
    ])
  })

  it('segue o rumo do principal', () => {
    const rotated: ScenarioSpec = { ...EMPTY_SCENARIO, crane: { x: 5, z: 5, headingDeg: 90 } }

    const { spec } = addExtraCrane(rotated, 'conf-1')

    expect(spec.cranes?.[0]?.placement.x).toBeCloseTo(5 + DEFAULT_CRANE_SPACING_M)
    expect(spec.cranes?.[0]?.placement.z).toBeCloseTo(5)
    expect(spec.cranes?.[0]?.placement.headingDeg).toBe(-90)
  })

  it('recusa passar do máximo de guindastes', () => {
    let spec: ScenarioSpec = EMPTY_SCENARIO
    for (let i = 0; i < MAX_EXTRA_CRANES; i += 1) spec = addExtraCrane(spec, 'c').spec

    expect(canAddExtraCrane(spec)).toBe(false)
    expect(addExtraCrane(spec, 'c')).toEqual({ spec, id: null })
  })

  it('não repete o id de um guindaste removido', () => {
    const two = addExtraCrane(addExtraCrane(EMPTY_SCENARIO, 'a').spec, 'b').spec
    const withoutFirst: ScenarioSpec = { ...two, cranes: two.cranes?.slice(1) }

    const { id } = addExtraCrane(withoutFirst, 'c')

    expect(id).toBe('extra-3')
  })

  it('põe a carga no meio dos dois, com o comprimento entre eles', () => {
    const { spec } = addExtraCrane(EMPTY_SCENARIO, 'conf-1')

    const cargo = defaultCargoBetween(spec)

    expect(cargo.x).toBeCloseTo(0)
    expect(cargo.z).toBeCloseTo(DEFAULT_CRANE_SPACING_M / 2)
    expect(cargo.rotationYDeg).toBeCloseTo(0)
  })
})
