// @vitest-environment jsdom
// Execução da trajetória planejada (TASK-075) com coleta e entrega (TASK-073): os quadros "Engatar" e
// "Soltar" chamam a cena, e um engate que falha para a execução ali. Dados FICTÍCIOS (ADR-012).

import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { keyframesCrossed, usePlanPlayback } from '../../src/app/planning/usePlanPlayback'
import type { PlanPhase, TrajectoryPoint } from '../../src/domain/planning/planning'
import type { CraneCommands } from '../../src/three/crane/types'

function point(tS: number, phase: PlanPhase, cableLengthM = 5): TrajectoryPoint {
  return {
    tS,
    craneIndex: 0,
    phase,
    state: { boomLengthM: 12, boomAngleDeg: 50, turretRotationDeg: tS * 10, cableLengthM },
  }
}

const TRAJECTORY: readonly TrajectoryPoint[] = [
  point(0, 'aproximar'),
  point(1, 'engatar', 9),
  point(2, 'levantar', 3),
  point(3, 'girar', 3),
  point(4, 'baixar', 9),
  point(5, 'soltar', 9),
]

function fakeCommands(): CraneCommands {
  const state = { boomLengthM: 12, boomAngleDeg: 50, turretRotationDeg: 0, cableLengthM: 5 }
  return {
    limits: { turretRotationDeg: { min: -180, max: 180 } },
    getState: () => ({ ...state }),
    setTurretRotation: (value: number) => (state.turretRotationDeg = value),
    setBoomAngle: (value: number) => (state.boomAngleDeg = value),
    setBoomLength: (value: number) => (state.boomLengthM = value),
    setCableLength: (value: number) => (state.cableLengthM = value),
    setState: (partial: Partial<typeof state>) => Object.assign(state, partial),
  } as unknown as CraneCommands
}

describe('quadros-chave cruzados', () => {
  it('conta o primeiro quadro no começo e os seguintes uma vez cada', () => {
    expect(keyframesCrossed(TRAJECTORY, 0, 0.5).map((p) => p.phase)).toEqual(['aproximar'])
    expect(keyframesCrossed(TRAJECTORY, 0.5, 2).map((p) => p.phase)).toEqual([
      'engatar',
      'levantar',
    ])
    expect(keyframesCrossed(TRAJECTORY, 2, 2.5)).toEqual([])
  })
})

describe('execução da trajetória', () => {
  let now = 0
  let queued: FrameRequestCallback[] = []
  beforeEach(() => {
    now = 0
    queued = []
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      queued.push(callback)
      return queued.length
    })
    vi.stubGlobal('cancelAnimationFrame', () => undefined)
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  function advance(ms: number): void {
    now += ms
    const callbacks = queued
    queued = []
    act(() => {
      for (const callback of callbacks) callback(now)
    })
  }

  it('engata no quadro "Engatar" com o cabo dele e solta no "Soltar"', () => {
    const commands = fakeCommands()
    const seen: { phase: PlanPhase; cable: number }[] = []
    const { result } = renderHook(() =>
      usePlanPlayback({
        points: TRAJECTORY,
        getCommands: () => commands,
        onMoved: () => undefined,
        onPlayingChange: () => undefined,
        onKeyframe: (keyframe) => {
          seen.push({ phase: keyframe.phase, cable: commands.getState().cableLengthM })
          return false
        },
      }),
    )
    act(() => result.current.start())
    for (let step = 0; step < 8; step += 1) advance(800)

    expect(seen.map((item) => item.phase)).toEqual([
      'aproximar',
      'engatar',
      'levantar',
      'girar',
      'baixar',
      'soltar',
    ])
    // O engate acontece com o estado exato do quadro (cabo baixado), não com o do passo seguinte.
    expect(seen.find((item) => item.phase === 'engatar')?.cable).toBe(9)
    expect(result.current.playing).toBe(false)
  })

  it('para no quadro em que o engate falha', () => {
    const commands = fakeCommands()
    const phases: PlanPhase[] = []
    const { result } = renderHook(() =>
      usePlanPlayback({
        points: TRAJECTORY,
        getCommands: () => commands,
        onMoved: () => undefined,
        onPlayingChange: () => undefined,
        onKeyframe: (keyframe) => {
          phases.push(keyframe.phase)
          return keyframe.phase === 'engatar'
        },
      }),
    )
    act(() => result.current.start())
    for (let step = 0; step < 8; step += 1) advance(800)

    expect(phases).toEqual(['aproximar', 'engatar'])
    expect(result.current.playing).toBe(false)
    expect(result.current.phase).toBe('engatar')
  })
})
