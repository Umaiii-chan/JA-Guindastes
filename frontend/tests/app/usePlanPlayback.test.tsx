// @vitest-environment jsdom
// Execução da trajetória planejada (TASK-075) com coleta e entrega (TASK-073): os quadros "Engatar" e
// "Soltar" chamam a cena, e um engate que falha para a execução ali. Dados FICTÍCIOS (ADR-012).

import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  keyframesCrossed,
  MAX_FRAME_DT_S,
  startsPhase,
  usePlanPlayback,
} from '../../src/app/planning/usePlanPlayback'
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
    // Quadros de 100 ms (o máximo que um quadro anda; TASK-092) até passar do fim (5 s).
    for (let step = 0; step < 60; step += 1) advance(100)

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

  it('reset zera o progresso e a fase, e a trajetória roda de novo do início (TASK-119)', () => {
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
          return false
        },
      }),
    )
    act(() => result.current.start())
    for (let step = 0; step < 60; step += 1) advance(100)
    expect(result.current.progress).toBe(1)
    expect(phases).toHaveLength(6)

    act(() => result.current.reset())
    expect(result.current.playing).toBe(false)
    expect(result.current.progress).toBe(0)
    expect(result.current.phase).toBeNull()

    act(() => result.current.start())
    for (let step = 0; step < 60; step += 1) advance(100)
    expect(phases).toHaveLength(12)
    expect(result.current.progress).toBe(1)
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
    for (let step = 0; step < 60; step += 1) advance(100)

    expect(phases).toEqual(['aproximar', 'engatar'])
    expect(result.current.playing).toBe(false)
    expect(result.current.phase).toBe('engatar')
  })

  it('um quadro longo (aba em segundo plano) anda no máximo 0,1 s, sem pular quadros-chave', () => {
    const commands = fakeCommands()
    const applied: number[] = []
    const setState = commands.setState.bind(commands)
    commands.setState = (partial) => {
      applied.push(partial.turretRotationDeg ?? Number.NaN)
      return setState(partial)
    }
    const phases: PlanPhase[] = []
    const { result } = renderHook(() =>
      usePlanPlayback({
        points: TRAJECTORY,
        getCommands: () => commands,
        onMoved: () => undefined,
        onPlayingChange: () => undefined,
        onKeyframe: (keyframe) => {
          phases.push(keyframe.phase)
          return false
        },
      }),
    )
    act(() => result.current.start())

    // 5 s parados (a aba voltou): antes, a execução saltava até o fim de uma vez.
    advance(5000)

    expect(MAX_FRAME_DT_S).toBe(0.1)
    expect(phases).toEqual(['aproximar'])
    // Giro FICTÍCIO da trajetória: 10°/s, então 0,1 s = 1°.
    expect(applied.at(-1)).toBeCloseTo(1, 9)
    expect(result.current.playing).toBe(true)

    // Na 4×, um quadro longo anda 0,4 s.
    act(() => result.current.setSpeed(4))
    advance(5000)
    expect(applied.at(-1)).toBeCloseTo(5, 9)
  })

  describe('tandem: o Guindaste 2 segue os quadros dele (TASK-125)', () => {
    /** Quadros do Guindaste 2: mesmos instantes, giro no sentido oposto e outro cabo. */
    const followerPoints: readonly TrajectoryPoint[] = TRAJECTORY.map((item) => ({
      ...item,
      craneIndex: 1,
      state: {
        ...item.state,
        turretRotationDeg: -item.tS * 10,
        cableLengthM: item.state.cableLengthM + 1,
      },
    }))

    function run(engaged: () => boolean) {
      const leader = fakeCommands()
      const follower = fakeCommands()
      const followerAtKeyframe: { phase: PlanPhase; turret: number; cable: number }[] = []
      const { result } = renderHook(() =>
        usePlanPlayback({
          points: TRAJECTORY,
          getCommands: () => leader,
          follower: {
            points: followerPoints,
            getCommands: () => follower,
            isEngaged: engaged,
          },
          onMoved: () => undefined,
          onPlayingChange: () => undefined,
          onKeyframe: (keyframe) => {
            const state = follower.getState()
            followerAtKeyframe.push({
              phase: keyframe.phase,
              turret: state.turretRotationDeg,
              cable: state.cableLengthM,
            })
            return false
          },
        }),
      )
      act(() => result.current.start())
      for (let step = 0; step < 60; step += 1) advance(100)
      return { follower, followerAtKeyframe }
    }

    it('antes do engate, o Guindaste 2 anda junto com o 1, da aproximação ao engate', () => {
      const { followerAtKeyframe } = run(() => false)

      const atEngage = followerAtKeyframe.find((item) => item.phase === 'engatar')
      // Giro dele no quadro "Engatar" (t = 1 s) e o cabo baixado dele (9 + 1), não os do Guindaste 1.
      expect(atEngage).toEqual({ phase: 'engatar', turret: -10, cable: 10 })
    })

    it('depois de soltar, o Guindaste 2 termina no último quadro dele', () => {
      const { follower } = run(() => false)

      expect(follower.getState().turretRotationDeg).toBe(-50)
      expect(follower.getState().cableLengthM).toBe(10)
    })

    it('engatado, quem conduz o Guindaste 2 é o tandem da cena: os quadros dele não são aplicados', () => {
      const { follower } = run(() => true)

      expect(follower.getState().turretRotationDeg).toBe(0)
    })
  })
})

describe('startsPhase', () => {
  it('only the first of consecutive keyframes of a phase starts it (two "engatar" from the planner)', () => {
    const plan = [
      point(0, 'aproximar'),
      point(2, 'engatar'),
      point(3, 'engatar'),
      point(5, 'levantar'),
    ]
    expect(plan.map((point) => startsPhase(plan, point))).toEqual([true, true, false, true])
  })
})
