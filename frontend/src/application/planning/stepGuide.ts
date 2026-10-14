// Passo a passo da operação planejada (TASK-075): da trajetória do backend sai uma lista de passos,
// um por fase, cada um com o estado a alcançar. A tela mostra a próxima ação ("Gire 35° à esquerda",
// "Baixe o cabo 3 m") e confere quando o usuário chega ao estado, dentro de uma tolerância. Só
// orientação: capacidade e segurança continuam sendo do backend (RN-008).

import {
  PLAN_PHASE_LABELS,
  type PlanCraneState,
  type PlanPhase,
  type PlanPlacement,
  type TrajectoryPoint,
} from '../../domain/planning/planning'
import { trajectoryOfCrane } from './trajectoryPlayback'

/** Tolerâncias FICTÍCIAS de conferência (graus e metros), na resolução dos controles da tela. */
export const GUIDE_TOLERANCE = Object.freeze({
  turretDeg: 2,
  boomAngleDeg: 1.5,
  boomLengthM: 0.4,
  cableM: 0.3,
  positionM: 0.5,
  headingDeg: 3,
})

export interface GuideStep {
  readonly index: number
  readonly phase: PlanPhase
  /** Estado a alcançar: o último quadro da fase. */
  readonly target: PlanCraneState
  /** Estado em que a fase começa (para o sentido do giro). */
  readonly from: PlanCraneState
  /** Só o usuário confirma (soltar a carga): o estado já foi alcançado no passo anterior. */
  readonly manual: boolean
}

/** Passos de um guindaste: um por fase, na ordem em que aparecem na trajetória. */
export function buildGuideSteps(
  trajectory: readonly TrajectoryPoint[],
  craneIndex = 0,
): readonly GuideStep[] {
  const points = trajectoryOfCrane(trajectory, craneIndex)
  const steps: GuideStep[] = []
  let from = points[0]?.state
  for (const point of points.slice(1)) {
    const last = steps[steps.length - 1]
    if (last && last.phase === point.phase) {
      steps[steps.length - 1] = { ...last, target: point.state }
    } else if (from) {
      steps.push({
        index: steps.length,
        phase: point.phase,
        from,
        target: point.state,
        manual: point.phase === 'soltar',
      })
    }
    from = point.state
  }
  return steps
}

/** Diferença `target - current` em graus, de -180 a 180. */
function shortestDelta(target: number, current: number): number {
  return ((((target - current + 180) % 360) + 360) % 360) - 180
}

/**
 * Giro que falta, no sentido do passo (o do backend pode ser o longo, por causa de um obstáculo):
 * positivo = anti-horário (esquerda). Se já passou do alvo, vale o caminho mais curto de volta.
 */
export function remainingTurretDeg(step: GuideStep, current: PlanCraneState): number {
  const total = step.target.turretRotationDeg - step.from.turretRotationDeg
  const direction = Math.abs(total) > 1e-6 ? Math.sign(total) : 0
  const short = shortestDelta(step.target.turretRotationDeg, current.turretRotationDeg)
  if (direction === 0) return short
  const forward = (((direction * short) % 360) + 360) % 360
  // `forward` é quanto falta andando no sentido do passo; acima do giro total, passou do alvo.
  if (forward > Math.abs(total) + GUIDE_TOLERANCE.turretDeg) return short
  return direction * forward
}

export interface GuideDelta {
  readonly turretDeg: number
  readonly boomAngleDeg: number
  readonly boomLengthM: number
  readonly cableM: number
}

/** O que falta em cada eixo para chegar ao alvo do passo (positivo = aumentar o valor). */
export function guideDelta(step: GuideStep, current: PlanCraneState): GuideDelta {
  return {
    turretDeg: remainingTurretDeg(step, current),
    boomAngleDeg: step.target.boomAngleDeg - current.boomAngleDeg,
    boomLengthM: step.target.boomLengthM - current.boomLengthM,
    cableM: step.target.cableLengthM - current.cableLengthM,
  }
}

export function reachedGuideTarget(step: GuideStep, current: PlanCraneState): boolean {
  const delta = guideDelta(step, current)
  return (
    Math.abs(delta.turretDeg) <= GUIDE_TOLERANCE.turretDeg &&
    Math.abs(delta.boomAngleDeg) <= GUIDE_TOLERANCE.boomAngleDeg &&
    Math.abs(delta.boomLengthM) <= GUIDE_TOLERANCE.boomLengthM &&
    Math.abs(delta.cableM) <= GUIDE_TOLERANCE.cableM
  )
}

function number(value: number, digits: number): string {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: digits })
}

/** Ações que faltam, na ordem em que a pessoa deve fazê-las; vazia se o alvo foi alcançado. */
export function guideActions(step: GuideStep, current: PlanCraneState): readonly string[] {
  const delta = guideDelta(step, current)
  const actions: string[] = []
  const turret = (): void => {
    if (Math.abs(delta.turretDeg) > GUIDE_TOLERANCE.turretDeg) {
      const side = delta.turretDeg > 0 ? 'esquerda' : 'direita'
      actions.push(`Gire ${number(Math.abs(delta.turretDeg), 0)}° à ${side}`)
    }
  }
  const length = (): void => {
    if (Math.abs(delta.boomLengthM) > GUIDE_TOLERANCE.boomLengthM) {
      const verb = delta.boomLengthM > 0 ? 'Estenda' : 'Recolha'
      actions.push(`${verb} a lança ${number(Math.abs(delta.boomLengthM), 1)} m`)
    }
  }
  const angle = (): void => {
    if (Math.abs(delta.boomAngleDeg) > GUIDE_TOLERANCE.boomAngleDeg) {
      const verb = delta.boomAngleDeg > 0 ? 'Levante' : 'Abaixe'
      actions.push(`${verb} a lança ${number(Math.abs(delta.boomAngleDeg), 0)}°`)
    }
  }
  const cable = (): void => {
    if (Math.abs(delta.cableM) > GUIDE_TOLERANCE.cableM) {
      const verb = delta.cableM > 0 ? 'Baixe' : 'Recolha'
      actions.push(`${verb} o cabo ${number(Math.abs(delta.cableM), 1)} m`)
    }
  }
  // A ordem segue a fase: levantar e engatar mexem no cabo; girar, no giro e na lança.
  const order: Record<PlanPhase, readonly (() => void)[]> = {
    aproximar: [length, angle, cable, turret],
    engatar: [cable, turret, length, angle],
    levantar: [cable, turret, length, angle],
    girar: [turret, angle, length, cable],
    baixar: [cable, turret, length, angle],
    soltar: [cable, turret, length, angle],
  }
  for (const action of order[step.phase]) action()
  return actions
}

/** Título curto do passo: o nome da fase ("Engatar"). */
export function guideStepTitle(step: GuideStep): string {
  return PLAN_PHASE_LABELS[step.phase]
}

/** Texto da ação do passo quando o alvo já foi alcançado. */
export function guideStepDoneText(step: GuideStep): string {
  switch (step.phase) {
    case 'aproximar':
      return 'Lança na posição da carga.'
    case 'engatar':
      return 'Gancho na carga: engate-a.'
    case 'levantar':
      return 'Carga erguida à altura de transporte.'
    case 'girar':
      return 'Carga sobre o ponto de entrega.'
    case 'baixar':
      return 'Carga no chão, na entrega.'
    case 'soltar':
      return 'Solte a carga do gancho.'
  }
}

/** O guindaste está na posição recomendada, dentro da tolerância? */
export function placementReached(
  current: { readonly x: number; readonly z: number; readonly headingDeg: number },
  target: PlanPlacement,
): boolean {
  const distance = Math.hypot(current.x - target.x, current.z - target.z)
  const heading = Math.abs(shortestDelta(target.headingDeg, current.headingDeg))
  return distance <= GUIDE_TOLERANCE.positionM && heading <= GUIDE_TOLERANCE.headingDeg
}
