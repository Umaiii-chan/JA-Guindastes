// Reprodução da trajetória planejada (TASK-075): estado do guindaste em cada instante, por
// interpolação linear entre os quadros-chave do backend, sem Three.js nem React. A trajetória é só
// uma sequência de estados a mostrar: capacidade e segurança continuam sendo do backend (RN-008).

import type { PlanCraneState, PlanPhase, TrajectoryPoint } from '../../domain/planning/planning'

/** Quadros-chave de um guindaste, em ordem de tempo. */
export function trajectoryOfCrane(
  trajectory: readonly TrajectoryPoint[],
  craneIndex = 0,
): readonly TrajectoryPoint[] {
  return trajectory.filter((point) => point.craneIndex === craneIndex).sort((a, b) => a.tS - b.tS)
}

/** Duração (s) da trajetória: o instante do último quadro. */
export function trajectoryDurationS(trajectory: readonly TrajectoryPoint[]): number {
  return trajectory.reduce((latest, point) => Math.max(latest, point.tS), 0)
}

function lerp(from: number, to: number, fraction: number): number {
  return from + (to - from) * fraction
}

export interface TrajectorySample {
  readonly state: PlanCraneState
  readonly phase: PlanPhase
}

/**
 * Estado e fase no instante `tS` (limitado a [0, duração]). Entre dois quadros, interpolação linear;
 * a fase é a do quadro de chegada do trecho.
 */
export function sampleTrajectory(
  points: readonly TrajectoryPoint[],
  tS: number,
): TrajectorySample | null {
  const first = points[0]
  const last = points[points.length - 1]
  if (!first || !last) return null
  if (tS <= first.tS) return { state: first.state, phase: first.phase }
  if (tS >= last.tS) return { state: last.state, phase: last.phase }
  for (let index = 1; index < points.length; index += 1) {
    const next = points[index]
    const previous = points[index - 1]
    if (!next || !previous || tS > next.tS) continue
    const span = next.tS - previous.tS
    const fraction = span > 0 ? (tS - previous.tS) / span : 1
    return {
      phase: next.phase,
      state: {
        boomLengthM: lerp(previous.state.boomLengthM, next.state.boomLengthM, fraction),
        boomAngleDeg: lerp(previous.state.boomAngleDeg, next.state.boomAngleDeg, fraction),
        turretRotationDeg: lerp(
          previous.state.turretRotationDeg,
          next.state.turretRotationDeg,
          fraction,
        ),
        cableLengthM: lerp(previous.state.cableLengthM, next.state.cableLengthM, fraction),
      },
    }
  }
  return { state: last.state, phase: last.phase }
}

/**
 * Giro equivalente a `degrees` dentro da faixa do guindaste: o ψ da trajetória é contínuo (pode
 * passar de ±180° para não pular na volta), e a cena só aceita valores da faixa dela. Sem
 * representante na faixa, limita ao extremo mais próximo.
 */
export function fitTurretRotation(degrees: number, range: { min: number; max: number }): number {
  if (range.max - range.min >= 360) {
    // Volta inteira: o representante mais perto do meio da faixa evita o limite.
    const middle = (range.min + range.max) / 2
    const turns = Math.round((middle - degrees) / 360)
    const fitted = degrees + turns * 360
    return Math.min(range.max, Math.max(range.min, fitted))
  }
  for (const turns of [0, -1, 1, -2, 2]) {
    const candidate = degrees + turns * 360
    if (candidate >= range.min && candidate <= range.max) return candidate
  }
  return Math.min(range.max, Math.max(range.min, degrees))
}
