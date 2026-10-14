import { describe, expect, it } from 'vitest'

import {
  EMPTY_SCENARIO,
  MAX_EXTRA_CRANES,
  type ScenarioSpec,
} from '../../../src/domain/environment/environment'
import {
  addExtraCrane,
  canAddExtraCrane,
  DEFAULT_CARGO_DISTANCE_M,
  DEFAULT_CRANE_SPACING_M,
  defaultCargoBetween,
} from '../../../src/application/tandem/tandemScenario'

describe('tandemScenario', () => {
  it('põe o guindaste novo ao lado do principal, com o mesmo rumo', () => {
    const { spec, id } = addExtraCrane(EMPTY_SCENARIO, 'conf-1')

    expect(id).toBe('extra-1')
    expect(spec.cranes).toEqual([
      {
        id: 'extra-1',
        configurationId: 'conf-1',
        placement: { x: DEFAULT_CRANE_SPACING_M, z: 0, headingDeg: 0 },
      },
    ])
  })

  it('segue o rumo do principal', () => {
    const rotated: ScenarioSpec = { ...EMPTY_SCENARIO, crane: { x: 5, z: 5, headingDeg: 90 } }

    const { spec } = addExtraCrane(rotated, 'conf-1')

    // Com o chassi virado para +X, a direita dele é -Z.
    expect(spec.cranes?.[0]?.placement.x).toBeCloseTo(5)
    expect(spec.cranes?.[0]?.placement.z).toBeCloseTo(5 - DEFAULT_CRANE_SPACING_M)
    expect(spec.cranes?.[0]?.placement.headingDeg).toBe(90)
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

  it('põe a carga à frente dos dois, no meio, com o comprimento ao longo da linha entre eles', () => {
    const { spec } = addExtraCrane(EMPTY_SCENARIO, 'conf-1')

    const cargo = defaultCargoBetween(spec)

    expect(cargo.x).toBeCloseTo(DEFAULT_CRANE_SPACING_M / 2)
    expect(cargo.z).toBeCloseTo(DEFAULT_CARGO_DISTANCE_M)
    // O comprimento (+Z da carga) aponta para +X, de um guindaste para o outro.
    expect(cargo.rotationYDeg).toBeCloseTo(90)
  })

  it('a carga acompanha o rumo do guindaste principal', () => {
    const rotated: ScenarioSpec = { ...EMPTY_SCENARIO, crane: { x: 0, z: 0, headingDeg: 90 } }
    const { spec } = addExtraCrane(rotated, 'conf-1')

    const cargo = defaultCargoBetween(spec)

    // Para a frente de um chassi virado para +X, a carga fica em +X; o guindaste 2 em -Z.
    expect(cargo.x).toBeCloseTo(DEFAULT_CARGO_DISTANCE_M)
    expect(cargo.z).toBeCloseTo(-DEFAULT_CRANE_SPACING_M / 2)
  })
})
