import { describe, expect, it } from 'vitest'

import { groundSlopeUnderCraneDeg } from '../../../src/application/environment/scenarioEditing'
import { shoePoints } from '../../../src/domain/environment/craneAttitude'
import {
  type ScenarioSpec,
  soilAt,
  terrainHeightAt,
  terrainSlopeDegAt,
} from '../../../src/domain/environment/environment'

// Paridade com o planejamento do backend (TASK-075): os mesmos números estão em
// `backend/tests/domain/services/planning/test_terrain.py`. O backend repete as fórmulas deste
// arquivo em Python (`app/domain/services/planning/terrain.py`); se uma ponta mudar, as duas falham.
// FICTÍCIO: cenário de exemplo.
const spec: ScenarioSpec = {
  terrain: {
    slopeXPercent: 2,
    slopeZPercent: -1.5,
    features: [
      { id: 'm', kind: 'mound', centerX: 5, centerZ: 3, radiusM: 6, heightM: 2 },
      { id: 'p', kind: 'pit', centerX: -6, centerZ: 2, radiusM: 4, heightM: 1.5 },
      { id: 'pl', kind: 'plateau', centerX: 0, centerZ: -8, radiusM: 7, heightM: 1 },
      {
        id: 'r',
        kind: 'ramp',
        centerX: 10,
        centerZ: -4,
        radiusM: 5,
        heightM: 2,
        directionDeg: 30,
        widthM: 4,
      },
      { id: 'f', kind: 'flatten', centerX: -2, centerZ: 6, radiusM: 5, heightM: 0.5 },
    ],
  },
  obstacles: [],
  crane: { x: 0, z: 0, headingDeg: 0 },
  soilZones: [
    { id: 's1', kind: 'rock', centerX: 4, centerZ: 3, radiusM: 5 },
    { id: 's2', kind: 'clay', centerX: 6, centerZ: 3, radiusM: 2 },
  ],
}

// [x, z, altura, inclinação em graus]
const GROUND_CASES: readonly (readonly [number, number, number, number])[] = [
  [0, 0, 0.0039147524128687605, 3.894080314239896],
  [5, 3, 2.055, 1.4320961841646513],
  [-6, 2, -1.65, 1.4320961841646338],
  [0, -8, 1.12, 1.4320961841646338],
  [10, -4, 1.26, 12.671679144815876],
  [12, -6, 1.8764101615137752, 12.671679144815858],
  [-2, 6, 0.5, 0],
  [-1, 5, 0.5, 0],
  [7.5, -3.2, 0.6849872981077807, 12.671679144815872],
  [20, 20, 0.10000000000000003, 1.4320961841646476],
]

describe('paridade do terreno com o planejamento do backend', () => {
  it('altura e inclinação nos pontos de referência', () => {
    for (const [x, z, height, slope] of GROUND_CASES) {
      expect(terrainHeightAt(spec.terrain, x, z)).toBeCloseTo(height, 9)
      expect(terrainSlopeDegAt(spec.terrain, x, z)).toBeCloseTo(slope, 9)
    }
  })

  it('inclinação sob as sapatas', () => {
    const cases = [
      { placement: { x: 0, z: 0, headingDeg: 0 }, slope: 5.8555710313747555 },
      { placement: { x: 5, z: 3, headingDeg: 35 }, slope: 1.4320961841646465 },
      { placement: { x: 9, z: -3, headingDeg: -120 }, slope: 11.652861830383388 },
    ]
    for (const { placement, slope } of cases) {
      expect(groundSlopeUnderCraneDeg({ ...spec, crane: placement })).toBeCloseTo(slope, 9)
    }
  })

  it('sapatas e solo', () => {
    const shoes = shoePoints(spec.terrain, { x: 5, z: 3, headingDeg: 35 })
    expect(shoes.map((shoe) => shoe.position)).toEqual(['fl', 'fr', 'rl', 'rr'])
    expect(shoes[0]?.x).toBeCloseTo(4.672849198330659, 9)
    expect(shoes[0]?.z).toBeCloseTo(6.89139722374459, 9)
    expect(shoes[3]?.y).toBeCloseTo(0.6635342217116396, 9)
    expect(soilAt(spec, 0, 0)).toBe('rock')
    expect(soilAt(spec, 5, 3)).toBe('clay')
    expect(soilAt(spec, 20, 20)).toBe('compacted')
  })
})
