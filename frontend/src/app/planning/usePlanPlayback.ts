// Executa a trajetória planejada na cena (TASK-075): a cada quadro de animação, aplica no guindaste o
// estado interpolado da trajetória. Os comandos limitam os valores à faixa do guindaste (clamp) e a
// guarda de colisão da cena continua valendo: se a carga encostar, o comando é cortado no último
// estado seguro, como numa operação manual.

import { useCallback, useEffect, useRef, useState } from 'react'

import {
  fitTurretRotation,
  sampleTrajectory,
  trajectoryDurationS,
} from '../../application/planning/trajectoryPlayback'
import type { PlanCraneState, PlanPhase, TrajectoryPoint } from '../../domain/planning/planning'
import type { CraneCommands } from '../../three/crane/types'

export const PLAYBACK_SPEEDS: readonly number[] = [1, 2, 4]
/** Intervalo mínimo (ms) entre dois avisos à tela durante a execução (a cena anima a cada quadro). */
const UI_REFRESH_MS = 120

export interface PlanPlaybackParams {
  /** Quadros-chave do guindaste que a cena mostra, em ordem de tempo. */
  readonly points: readonly TrajectoryPoint[]
  /** Comandos do guindaste da cena agora (muda quando a cena é montada de novo). */
  getCommands(): CraneCommands | null
  /** Avisa a tela de que o estado do guindaste mudou. */
  onMoved(): void
  onPlayingChange(playing: boolean): void
}

export interface PlanPlayback {
  readonly playing: boolean
  readonly progress: number
  readonly phase: PlanPhase | null
  readonly speed: number
  setSpeed(speed: number): void
  start(): void
  stop(): void
}

/**
 * Aplica um estado da trajetória nos comandos da cena. A ordem importa para a guarda de colisão da
 * cena: o cabo sobe antes de qualquer outro movimento e só desce depois dos demais, para a carga não
 * varrer o chão nem o guindaste no meio do caminho.
 */
export function applyPlanState(commands: CraneCommands, state: PlanCraneState): void {
  const raising = state.cableLengthM < commands.getState().cableLengthM
  if (raising) commands.setCableLength(state.cableLengthM)
  commands.setTurretRotation(
    fitTurretRotation(state.turretRotationDeg, commands.limits.turretRotationDeg),
  )
  commands.setBoomLength(state.boomLengthM)
  commands.setBoomAngle(state.boomAngleDeg)
  if (!raising) commands.setCableLength(state.cableLengthM)
}

export function usePlanPlayback({
  points,
  getCommands,
  onMoved,
  onPlayingChange,
}: PlanPlaybackParams): PlanPlayback {
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [phase, setPhase] = useState<PlanPhase | null>(null)
  const [speed, setSpeed] = useState(PLAYBACK_SPEEDS[0] ?? 1)
  const frame = useRef<number | null>(null)
  const speedRef = useRef(speed)
  const callbacks = useRef({ getCommands, onMoved, onPlayingChange })
  // As leituras da animação veem sempre o valor mais recente, sem recriar o laço.
  useEffect(() => {
    speedRef.current = speed
    callbacks.current = { getCommands, onMoved, onPlayingChange }
  })

  const cancel = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current)
    frame.current = null
  }, [])

  const stop = useCallback(() => {
    cancel()
    setPlaying(false)
    callbacks.current.onPlayingChange(false)
    callbacks.current.onMoved()
  }, [cancel])

  const start = useCallback(() => {
    const duration = trajectoryDurationS(points)
    if (points.length < 2 || duration <= 0) return
    cancel()
    setPlaying(true)
    callbacks.current.onPlayingChange(true)
    let elapsed = 0
    let last = performance.now()
    let lastRefresh = 0
    const tick = (now: number) => {
      elapsed += ((now - last) / 1000) * speedRef.current
      last = now
      const commands = callbacks.current.getCommands()
      const sample = sampleTrajectory(points, Math.min(elapsed, duration))
      if (commands && sample) {
        applyPlanState(commands, sample.state)
        setPhase(sample.phase)
        setProgress(Math.min(1, elapsed / duration))
        if (now - lastRefresh >= UI_REFRESH_MS) {
          lastRefresh = now
          callbacks.current.onMoved()
        }
      }
      if (elapsed >= duration || !commands) {
        frame.current = null
        setPlaying(false)
        callbacks.current.onPlayingChange(false)
        callbacks.current.onMoved()
        return
      }
      frame.current = requestAnimationFrame(tick)
    }
    frame.current = requestAnimationFrame(tick)
  }, [cancel, points])

  // Sair da página ou trocar a trajetória interrompe a execução.
  useEffect(() => cancel, [cancel])

  return { playing, progress, phase, speed, setSpeed, start, stop }
}
