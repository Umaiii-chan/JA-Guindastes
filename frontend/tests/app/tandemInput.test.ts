import { describe, expect, it } from 'vitest'

import {
  buildTandemInput,
  EXTRA_CRANE_OUTRIGGERS,
  type TandemInputSource,
} from '../../src/app/tandemInput'
import { EMPTY_SCENARIO, type ScenarioSpec } from '../../src/domain/environment/environment'
import type { EvaluationInput } from '../../src/domain/evaluation/evaluation'

// TASK-090: o pedido do tandem leva o ambiente de cada guindaste. Cenário, estados e carga FICTÍCIOS
// (ADR-012): o principal na origem, o segundo 8 m ao lado, a carga 10,5 m à frente dos dois.

const STATE = { turretRotationDeg: 10, boomAngleDeg: 30, boomLengthM: 12, cableLengthM: 6 }

const SPEC: ScenarioSpec = {
  ...EMPTY_SCENARIO,
  crane: { x: 0, z: 0, headingDeg: 0 },
  cranes: [{ id: 'extra-1', configurationId: 'CFG-2', placement: { x: 8, z: 0, headingDeg: 0 } }],
  // Argila só em volta do segundo guindaste (as sapatas dele ficam a 3,9 m do centro).
  soilZones: [{ id: 'argila', kind: 'clay', centerX: 8, centerZ: 0, radiusM: 5 }],
  wind: { speedMs: 12, directionDeg: 0 },
  obstacles: [
    {
      id: 'poste-2',
      label: 'Poste perto do 2',
      kind: 'box',
      centerX: 8,
      centerZ: 5,
      widthM: 1,
      depthM: 1,
      heightM: 8,
      rotationYDeg: 0,
    },
  ],
}

/** Avaliação individual do guindaste 1, como `buildEvaluationInput` a monta. */
const LEADER_EVALUATION: EvaluationInput = {
  configurationId: 'CFG-1',
  ...STATE,
  loadWeightKg: 0,
  outriggers: { extensionPercent: 50, jacksSet: false },
  groundSlopeDeg: 0.8,
  accessoryIds: ['ACC-MANILHA'],
  soilKinds: ['compacted', 'compacted', 'compacted', 'compacted'],
  windSpeedMs: 12,
  obstacleConflicts: ['Poste'],
}

function source(evaluation: EvaluationInput | null = LEADER_EVALUATION): TandemInputSource {
  return {
    frame: {
      leaderState: STATE,
      followerState: { ...STATE, turretRotationDeg: -10 },
      cargo: { x: 4, z: 10.5, rotationYDeg: 90 },
    },
    load: { lengthM: 8, widthM: 2, heightM: 1.5, cgAlongLengthM: 1 },
    loadWeightKg: 4600,
    spec: SPEC,
    leader: { configurationId: 'CFG-1', placement: SPEC.crane, evaluation },
    follower: {
      configurationId: 'CFG-2',
      placement: { x: 8, z: 0, headingDeg: 0 },
      parameters: { boomPivotOffsetM: 0.46, boomPivotHeightM: 3.3 },
    },
  }
}

describe('buildTandemInput', () => {
  it('manda os pontos de içamento da carga, não a posição dos ganchos', () => {
    const input = buildTandemInput(source())

    // Carga girada 90°: o comprimento vai em X, com os pontos a 1/4 e 3/4 dele.
    expect(input.cranes[0].hookPoint.x).toBeCloseTo(2)
    expect(input.cranes[0].hookPoint.z).toBeCloseTo(10.5)
    expect(input.cranes[1].hookPoint.x).toBeCloseTo(6)
    expect(input.cranes[1].hookPoint.z).toBeCloseTo(10.5)
    expect(input.loadCg.x).toBeCloseTo(5)
    expect(input.loadWeightKg).toBe(4600)
  })

  it('o guindaste 1 vai com o mesmo ambiente e os acessórios da avaliação individual', () => {
    const [leader] = buildTandemInput(source()).cranes

    expect(leader).toMatchObject({
      configurationId: 'CFG-1',
      placement: SPEC.crane,
      state: STATE,
      outriggers: { extensionPercent: 50, jacksSet: false },
      groundSlopeDeg: 0.8,
      accessoryIds: ['ACC-MANILHA'],
      soilKinds: ['compacted', 'compacted', 'compacted', 'compacted'],
      obstacleConflicts: ['Poste'],
    })
    expect(leader).not.toHaveProperty('windSpeedMs')
  })

  it('o guindaste 2 vai com o chão e os obstáculos da posição dele, sem acessórios', () => {
    const [, follower] = buildTandemInput(source()).cranes

    expect(follower.outriggers).toEqual(EXTRA_CRANE_OUTRIGGERS)
    expect(follower.soilKinds).toEqual(['clay', 'clay', 'clay', 'clay'])
    expect(follower.obstacleConflicts).toEqual(['Poste perto do 2'])
    expect(follower).not.toHaveProperty('accessoryIds')
    // Terreno plano: sem inclinação, como na avaliação individual.
    expect(follower).not.toHaveProperty('groundSlopeDeg')
  })

  it('a inclinação do guindaste 2 sai do terreno sob ele', () => {
    const sloped = {
      ...source(),
      spec: { ...SPEC, terrain: { ...SPEC.terrain, slopeXPercent: 5 } },
    }

    const [, follower] = buildTandemInput(sloped).cranes

    expect(follower.groundSlopeDeg).toBeGreaterThan(2.5)
    expect(follower.groundSlopeDeg).toBeLessThan(3)
  })

  it('o vento é comum aos dois', () => {
    expect(buildTandemInput(source()).windSpeedMs).toBe(12)
    const calm = { ...source(), spec: { ...SPEC, wind: undefined } }
    expect(buildTandemInput(calm)).not.toHaveProperty('windSpeedMs')
  })

  it('sem a avaliação individual, o guindaste 1 vai sem ambiente (como antes)', () => {
    const [leader] = buildTandemInput(source(null)).cranes

    expect(Object.keys(leader).sort()).toEqual([
      'configurationId',
      'hookPoint',
      'placement',
      'state',
    ])
  })
})
