import { describe, expect, it } from 'vitest'

import type { CraneBody } from '../../../src/domain/collision/collisions'
import {
  evaluateMultiCraneCollisions,
  type HoistedCargo,
  type MultiCrane,
} from '../../../src/domain/collision/multiCraneCollisions'
import { EMPTY_SCENARIO } from '../../../src/domain/environment/environment'

// Corpo FICTÍCIO: só uma caixa de lança de 10 m, a partir do pino a 3 m de altura.
const BODY: CraneBody = {
  boxes: [
    { id: 'lança', frame: 'boom', center: { x: 0, y: 0, z: 5 }, half: { x: 0.4, y: 0.4, z: 5 } },
  ],
  turretOffset: { x: 0, y: 0, z: 0 },
  boomPivot: { x: 0, y: 3, z: 0 },
  extensionOffset: { x: 0, y: 0, z: 0 },
  boomRetractedLengthM: 10,
}

const STATE = { turretRotationDeg: 0, boomAngleDeg: 0, boomLengthM: 10, cableLengthM: 3 }

function crane(label: string, x: number, z: number, headingDeg: number): MultiCrane {
  return { label, placement: { x, z, headingDeg }, state: STATE, body: BODY }
}

describe('colisões entre os guindastes', () => {
  it('lança contra lança que se cruzam', () => {
    const report = evaluateMultiCraneCollisions({
      scenario: EMPTY_SCENARIO,
      cranes: [crane('Guindaste 1', -6, 0, 90), crane('Guindaste 2', 6, 0, -90)],
      cargo: null,
    })

    expect(report.hits.length).toBeGreaterThan(0)
    expect(report.hits.every((hit) => hit.subject === 'crane')).toBe(true)
    expect(report.penetrationM).toBeGreaterThan(0)
  })

  it('sem colisão quando as lanças passam lado a lado', () => {
    const report = evaluateMultiCraneCollisions({
      scenario: EMPTY_SCENARIO,
      cranes: [crane('Guindaste 1', -6, -3, 90), crane('Guindaste 2', 6, 3, -90)],
      cargo: null,
    })

    expect(report.hits).toEqual([])
    expect(report.penetrationM).toBe(0)
  })

  it('sem colisão quando uma lança passa acima da outra', () => {
    const high = { ...crane('Guindaste 2', 6, 0, -90), state: { ...STATE, boomAngleDeg: 0 } }
    const raisedBody: CraneBody = { ...BODY, boomPivot: { x: 0, y: 9, z: 0 } }

    const report = evaluateMultiCraneCollisions({
      scenario: EMPTY_SCENARIO,
      cranes: [crane('Guindaste 1', -6, 0, 90), { ...high, body: raisedBody }],
      cargo: null,
    })

    expect(report.hits).toEqual([])
  })
})

describe('colisões da carga içada', () => {
  const cargo: HoistedCargo = {
    x: 0,
    z: 0,
    rotationYDeg: 0,
    bottomY: 1,
    lengthM: 4,
    widthM: 2,
    heightM: 1,
  }
  const apart = [crane('Guindaste 1', -20, 0, 90), crane('Guindaste 2', 20, 0, -90)]

  it('carga suspensa e livre não colide', () => {
    const report = evaluateMultiCraneCollisions({ scenario: EMPTY_SCENARIO, cranes: apart, cargo })

    expect(report.hits).toEqual([])
  })

  it('carga abaixo do terreno colide com ele', () => {
    const report = evaluateMultiCraneCollisions({
      scenario: EMPTY_SCENARIO,
      cranes: apart,
      cargo: { ...cargo, bottomY: -0.3 },
    })

    expect(report.hits.map((hit) => hit.target.kind)).toContain('terrain')
    expect(report.penetrationM).toBeGreaterThan(0)
  })

  it('carga contra um obstáculo', () => {
    const scenario = {
      ...EMPTY_SCENARIO,
      obstacles: [
        {
          id: 'o1',
          label: 'Caixa',
          kind: 'box' as const,
          centerX: 0,
          centerZ: 0,
          widthM: 2,
          depthM: 2,
          heightM: 3,
          rotationYDeg: 0,
        },
      ],
    }

    const report = evaluateMultiCraneCollisions({ scenario, cranes: apart, cargo })

    expect(report.hits.map((hit) => hit.target.kind)).toContain('obstacle')
  })

  it('carga contra o corpo de um dos guindastes', () => {
    const near = [crane('Guindaste 1', -6, 0, 90), crane('Guindaste 2', 40, 0, -90)]

    const report = evaluateMultiCraneCollisions({
      scenario: EMPTY_SCENARIO,
      cranes: near,
      cargo: { ...cargo, bottomY: 2.7, heightM: 0.6 },
    })

    expect(report.hits.some((hit) => hit.subject === 'load' && hit.target.kind === 'crane')).toBe(
      true,
    )
  })
})
