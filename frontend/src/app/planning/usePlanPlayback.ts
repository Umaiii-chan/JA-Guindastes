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
/**
 * Intervalo mínimo (ms) entre dois avisos à tela durante a execução (~5 Hz): a cena anima a cada
 * quadro, mas o estado React (progresso, números) só muda neste ritmo (TASK-077). Com a gravação
 * ligada, a tela passa a ~10 Hz (`recordingRefreshMs`), que é o ritmo dos quadros do gravador.
 */
export const UI_REFRESH_MS = 200
export const RECORDING_UI_REFRESH_MS = 100

export interface PlanPlaybackParams {
  /** Quadros-chave do guindaste que a cena mostra, em ordem de tempo. */
  readonly points: readonly TrajectoryPoint[]
  /** Comandos do guindaste da cena agora (muda quando a cena é montada de novo). */
  getCommands(): CraneCommands | null
  /** Avisa a tela de que o estado do guindaste mudou. */
  onMoved(): void
  onPlayingChange(playing: boolean): void
  /** Intervalo (ms) entre avisos à tela; padrão `UI_REFRESH_MS`. Mais curto enquanto grava. */
  refreshMs?: number
  /**
   * Avisa quando a execução passa por um quadro-chave, já com o estado dele aplicado na cena: a
   * tela usa para engatar a carga no quadro "Engatar" e soltá-la no "Soltar" (TASK-073). Devolve
   * `true` para parar a execução ali (o engate falhou, por exemplo).
   */
  onKeyframe?(point: TrajectoryPoint): boolean
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
 * Aplica um estado da trajetória nos comandos da cena, de uma vez só: a guarda de colisão confere o
 * estado final (não cada comando em sequência, que podia bloquear uma combinação intermediária e
 * fazer a pose pular). O giro é trazido para a faixa do guindaste.
 */
export function applyPlanState(commands: CraneCommands, state: PlanCraneState): void {
  commands.setState({
    turretRotationDeg: fitTurretRotation(
      state.turretRotationDeg,
      commands.limits.turretRotationDeg,
    ),
    boomLengthM: state.boomLengthM,
    boomAngleDeg: state.boomAngleDeg,
    cableLengthM: state.cableLengthM,
  })
}

/** Quadros-chave com instante em (`fromS`, `toS`]; o primeiro quadro conta quando `fromS` é 0. */
export function keyframesCrossed(
  points: readonly TrajectoryPoint[],
  fromS: number,
  toS: number,
): readonly TrajectoryPoint[] {
  return points.filter(
    (point) => (point.tS > fromS || (fromS === 0 && point.tS === 0)) && point.tS <= toS,
  )
}

export function usePlanPlayback({
  points,
  getCommands,
  onMoved,
  onPlayingChange,
  onKeyframe,
  refreshMs = UI_REFRESH_MS,
}: PlanPlaybackParams): PlanPlayback {
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [phase, setPhase] = useState<PlanPhase | null>(null)
  const [speed, setSpeed] = useState(PLAYBACK_SPEEDS[0] ?? 1)
  const frame = useRef<number | null>(null)
  const speedRef = useRef(speed)
  const refreshMsRef = useRef(refreshMs)
  const callbacks = useRef({ getCommands, onMoved, onPlayingChange, onKeyframe })
  // As leituras da animação veem sempre o valor mais recente, sem recriar o laço.
  useEffect(() => {
    speedRef.current = speed
    refreshMsRef.current = refreshMs
    callbacks.current = { getCommands, onMoved, onPlayingChange, onKeyframe }
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
      const before = elapsed
      elapsed += ((now - last) / 1000) * speedRef.current
      last = now
      const commands = callbacks.current.getCommands()
      // Quadros-chave cruzados neste passo: cada um é aplicado exatamente antes de seguir.
      if (commands) {
        for (const point of keyframesCrossed(points, before, Math.min(elapsed, duration))) {
          applyPlanState(commands, point.state)
          setPhase(point.phase)
          if (callbacks.current.onKeyframe?.(point) === true) {
            frame.current = null
            setPhase(point.phase)
            setPlaying(false)
            callbacks.current.onPlayingChange(false)
            callbacks.current.onMoved()
            return
          }
        }
      }
      const sample = sampleTrajectory(points, Math.min(elapsed, duration))
      if (commands && sample) {
        applyPlanState(commands, sample.state)
        // A cena segue a cada quadro; a tela (React) só a ~10 Hz.
        if (now - lastRefresh >= refreshMsRef.current) {
          lastRefresh = now
          setPhase(sample.phase)
          setProgress(Math.min(1, elapsed / duration))
          callbacks.current.onMoved()
        }
      }
      if (elapsed >= duration || !commands) {
        frame.current = null
        if (commands) setProgress(1)
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
