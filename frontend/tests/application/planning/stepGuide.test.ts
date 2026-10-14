import { describe, expect, it } from 'vitest'

import {
  buildGuideSteps,
  GUIDE_TOLERANCE,
  guideActions,
  placementReached,
  reachedGuideTarget,
  remainingTurretDeg,
} from '../../../src/application/planning/stepGuide'
import {
  fitTurretRotation,
  sampleTrajectory,
  trajectoryDurationS,
  trajectoryOfCrane,
} from '../../../src/application/planning/trajectoryPlayback'
import type {
  PlanCraneState,
  PlanPhase,
  TrajectoryPoint,
} from '../../../src/domain/planning/planning'

// FICTÍCIO: trajetória de exemplo no formato do backend (um guindaste).
function point(
  tS: number,
  phase: PlanPhase,
  turret: number,
  angle: number,
  cable: number,
  craneIndex = 0,
): TrajectoryPoint {
  return {
    tS,
    craneIndex,
    phase,
    state: { boomLengthM: 12, boomAngleDeg: angle, turretRotationDeg: turret, cableLengthM: cable },
  }
}

const TRAJECTORY: readonly TrajectoryPoint[] = [
  point(0, 'aproximar', -50, 75, 1),
  point(10, 'aproximar', -50, 40, 5),
  point(14, 'engatar', -50, 40, 8),
  point(16, 'engatar', -50, 40, 8),
  point(20, 'levantar', -50, 40, 4),
  point(25, 'girar', 0, 40, 4),
  point(30, 'girar', 50, 40, 4),
  point(34, 'baixar', 50, 40, 8),
  point(36, 'soltar', 50, 40, 8),
]

describe('passos do guia', () => {
  const steps = buildGuideSteps(TRAJECTORY)

  it('um passo por fase, na ordem, com o último quadro como alvo', () => {
    expect(steps.map((step) => step.phase)).toEqual([
      'aproximar',
      'engatar',
      'levantar',
      'girar',
      'baixar',
      'soltar',
    ])
    expect(steps[3]?.target.turretRotationDeg).toBe(50)
    expect(steps[3]?.from.turretRotationDeg).toBe(-50)
  })

  it('só o passo de soltar a carga é confirmado pela pessoa', () => {
    expect(steps.filter((step) => step.manual).map((step) => step.phase)).toEqual(['soltar'])
  })

  it('diz o que falta: gire, baixe o cabo, levante a lança', () => {
    const swing = steps[3]!
    const current: PlanCraneState = {
      boomLengthM: 12,
      boomAngleDeg: 40,
      turretRotationDeg: 15,
      cableLengthM: 4,
    }
    expect(guideActions(swing, current)).toEqual(['Gire 35° à esquerda'])
    expect(guideActions(steps[4]!, { ...current, turretRotationDeg: 50 })).toEqual([
      'Baixe o cabo 4 m',
    ])
    // Aproximar: lança a 40°, cabo a 5 m, giro em -50° (o gancho de partida está erguido).
    const start = { ...current, turretRotationDeg: -50 }
    expect(guideActions(steps[0]!, { ...start, boomAngleDeg: 60, cableLengthM: 1 })).toEqual([
      'Abaixe a lança 20°',
      'Baixe o cabo 4 m',
    ])
    expect(
      guideActions(steps[0]!, { ...start, boomAngleDeg: 60, boomLengthM: 15, cableLengthM: 5 }),
    ).toEqual(['Recolha a lança 3 m', 'Abaixe a lança 20°'])
  })

  it('o giro longo do backend vale: o sentido do passo, não o atalho', () => {
    const longWay = buildGuideSteps([
      point(0, 'girar', -50, 40, 4),
      point(10, 'girar', -300, 40, 4), // 250° pela direita
    ])[0]!
    const current: PlanCraneState = {
      boomLengthM: 12,
      boomAngleDeg: 40,
      turretRotationDeg: -50,
      cableLengthM: 4,
    }

    expect(remainingTurretDeg(longWay, current)).toBeCloseTo(-250)
    expect(guideActions(longWay, current)[0]).toBe('Gire 250° à direita')
  })

  it('confere o estado dentro da tolerância e equivalente a 360°', () => {
    const swing = steps[3]!
    const base: PlanCraneState = {
      boomLengthM: 12,
      boomAngleDeg: 40,
      turretRotationDeg: 50,
      cableLengthM: 4,
    }

    expect(reachedGuideTarget(swing, base)).toBe(true)
    expect(reachedGuideTarget(swing, { ...base, turretRotationDeg: 50 + 360 })).toBe(true)
    expect(
      reachedGuideTarget(swing, {
        ...base,
        turretRotationDeg: 50 + GUIDE_TOLERANCE.turretDeg - 0.1,
      }),
    ).toBe(true)
    expect(
      reachedGuideTarget(swing, { ...base, turretRotationDeg: 50 + GUIDE_TOLERANCE.turretDeg + 1 }),
    ).toBe(false)
    expect(reachedGuideTarget(swing, { ...base, cableLengthM: 4.5 })).toBe(false)
  })

  it('posição do guindaste dentro da tolerância', () => {
    const target = { x: 2, z: -3, headingDeg: 90 }

    expect(placementReached({ x: 2.2, z: -3.1, headingDeg: 91 }, target)).toBe(true)
    expect(placementReached({ x: 4, z: -3, headingDeg: 90 }, target)).toBe(false)
    expect(placementReached({ x: 2, z: -3, headingDeg: 130 }, target)).toBe(false)
    // 450° é o mesmo rumo que 90°.
    expect(placementReached({ x: 2, z: -3, headingDeg: 450 }, target)).toBe(true)
  })
})

describe('reprodução da trajetória', () => {
  const points = trajectoryOfCrane(TRAJECTORY)

  it('interpola linearmente entre os quadros e informa a fase', () => {
    const sample = sampleTrajectory(points, 27.5)

    expect(sample?.phase).toBe('girar')
    expect(sample?.state.turretRotationDeg).toBeCloseTo(25)
    expect(sampleTrajectory(points, 5)?.state.boomAngleDeg).toBeCloseTo(57.5)
  })

  it('antes do início e depois do fim vale o primeiro e o último quadro', () => {
    expect(sampleTrajectory(points, -3)?.state.cableLengthM).toBe(1)
    expect(sampleTrajectory(points, 999)?.phase).toBe('soltar')
    expect(trajectoryDurationS(points)).toBe(36)
    expect(sampleTrajectory([], 1)).toBeNull()
  })

  it('separa os quadros de cada guindaste do tandem', () => {
    const tandem = [...TRAJECTORY, point(0, 'aproximar', 10, 60, 2, 1)]

    expect(trajectoryOfCrane(tandem, 1)).toHaveLength(1)
    expect(trajectoryOfCrane(tandem, 0)).toHaveLength(TRAJECTORY.length)
  })

  it('ψ contínuo cabe na faixa do guindaste', () => {
    expect(fitTurretRotation(-308, { min: -180, max: 180 })).toBeCloseTo(52)
    expect(fitTurretRotation(190, { min: 0, max: 360 })).toBe(190)
    expect(fitTurretRotation(-170, { min: 0, max: 360 })).toBe(190)
    expect(fitTurretRotation(400, { min: -30, max: 30 })).toBe(30)
  })
})
