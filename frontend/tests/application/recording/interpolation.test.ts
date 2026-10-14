// Interpolação da pose na reprodução (TASK-077). Dados FICTÍCIOS (ADR-012).

import { describe, expect, it } from 'vitest'

import {
  interpolateCraneState,
  shortestAngleDeltaDeg,
} from '../../../src/application/recording/playback'
import type { RecordingFrame } from '../../../src/application/recording/recording'

function frame(tMs: number, turret: number, cable: number): RecordingFrame {
  return {
    tMs,
    crane: {
      turretRotationDeg: turret,
      boomAngleDeg: 40 + tMs / 100,
      boomLengthM: 12,
      cableLengthM: cable,
    },
    configurationId: 'cfg',
    loadWeightKg: 1000,
    evaluation: null,
  }
}

describe('shortestAngleDeltaDeg', () => {
  it('vai pelo caminho mais curto, também na volta de 360°', () => {
    expect(shortestAngleDeltaDeg(10, 50)).toBe(40)
    expect(shortestAngleDeltaDeg(170, -170)).toBe(20)
    expect(shortestAngleDeltaDeg(-170, 170)).toBe(-20)
    expect(shortestAngleDeltaDeg(30, 30)).toBe(0)
  })
})

describe('interpolateCraneState', () => {
  const frames = [frame(0, 0, 4), frame(1000, 60, 10), frame(2000, 60, 10)]

  it('interpola linearmente entre quadros vizinhos', () => {
    const half = interpolateCraneState(frames, 500)
    expect(half?.turretRotationDeg).toBeCloseTo(30)
    expect(half?.cableLengthM).toBeCloseTo(7)
    expect(half?.boomAngleDeg).toBeCloseTo(45)
    expect(half?.boomLengthM).toBe(12)
  })

  it('devolve o próprio quadro no instante exato, antes do primeiro e depois do último', () => {
    expect(interpolateCraneState(frames, 1000)?.turretRotationDeg).toBe(60)
    expect(interpolateCraneState(frames, -50)?.turretRotationDeg).toBe(0)
    expect(interpolateCraneState(frames, 9999)?.cableLengthM).toBe(10)
  })

  it('gira pelo caminho mais curto ao cruzar ±180°', () => {
    const wrap = [frame(0, 170, 5), frame(1000, -170, 5)]
    expect(interpolateCraneState(wrap, 500)?.turretRotationDeg).toBeCloseTo(180)
    expect(interpolateCraneState(wrap, 250)?.turretRotationDeg).toBeCloseTo(175)
  })

  it('sem quadros, não há pose', () => {
    expect(interpolateCraneState([], 0)).toBeNull()
  })
})
