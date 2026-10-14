import { describe, expect, it } from 'vitest'

import {
  FLAT_TERRAIN,
  type TerrainSpec,
  terrainHeightAt,
  terrainSlopeDegAt,
  terrainSlopeUnderFootprintDeg,
} from '../../../src/domain/environment/environment'

// FICTÍCIO: terrenos de exemplo.
const mound: TerrainSpec = {
  slopeXPercent: 0,
  slopeZPercent: 0,
  features: [{ id: 'm', kind: 'mound', centerX: 10, centerZ: 0, radiusM: 4, heightM: 2 }],
}

describe('terreno (contrato da leva E)', () => {
  it('plano: altura zero e inclinação zero', () => {
    expect(terrainHeightAt(FLAT_TERRAIN, 5, -3)).toBe(0)
    expect(terrainSlopeDegAt(FLAT_TERRAIN, 5, -3)).toBeCloseTo(0)
  })

  it('plano inclinado: 10 % em X sobe 1 m a cada 10 m (~5,71°)', () => {
    const spec = { ...FLAT_TERRAIN, slopeXPercent: 10 }
    expect(terrainHeightAt(spec, 10, 0)).toBeCloseTo(1)
    expect(terrainSlopeDegAt(spec, 0, 0)).toBeCloseTo(5.7106, 3)
    expect(terrainSlopeUnderFootprintDeg(spec, { x: 0, z: 0, headingDeg: 0 }, 3, 2)).toBeCloseTo(
      5.7106,
      3,
    )
  })

  it('elevação, depressão, platô e rampa', () => {
    expect(terrainHeightAt(mound, 10, 0)).toBeCloseTo(2)
    expect(terrainHeightAt(mound, 12, 0)).toBeCloseTo(1)
    expect(terrainHeightAt(mound, 14, 0)).toBeCloseTo(0)
    const pit: TerrainSpec = {
      ...mound,
      features: [{ ...mound.features[0], kind: 'pit' }],
    }
    expect(terrainHeightAt(pit, 10, 0)).toBeCloseTo(-2)
    const plateau: TerrainSpec = {
      ...mound,
      features: [{ ...mound.features[0], kind: 'plateau' }],
    }
    expect(terrainHeightAt(plateau, 12, 0)).toBeCloseTo(2)
    const ramp: TerrainSpec = {
      ...FLAT_TERRAIN,
      features: [
        { id: 'r', kind: 'ramp', centerX: 0, centerZ: 0, radiusM: 5, heightM: 1, widthM: 4 },
      ],
    }
    expect(terrainHeightAt(ramp, -5, 0)).toBeCloseTo(0)
    expect(terrainHeightAt(ramp, 0, 0)).toBeCloseTo(0.5)
    expect(terrainHeightAt(ramp, 5, 0)).toBeCloseTo(1)
    expect(terrainHeightAt(ramp, 0, 3)).toBe(0)
  })
})
