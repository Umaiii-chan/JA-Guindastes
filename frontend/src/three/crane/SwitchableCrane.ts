import type {
  CraneGeometryParameters,
  OperationalGeometry,
} from '../../domain/geometry/operationalGeometry'
import type { CollisionReport, CollisionState } from '../../domain/collision/collisions'
import { CraneController, type CraneRig } from './CraneController'
import { fitTurretToRange, turretTravelDeg } from './turretRotation'
import type { CraneCommands, CraneLimits, CraneState, TurretRange } from './types'

/**
 * Guarda de colisões (TASK-053; ADR-028; RN-012): `evaluate` diz o que um estado atingiria e
 * `onResult` recebe o estado de colisão depois de cada comando.
 */
export interface CollisionGuard {
  evaluate(state: CraneState): CollisionReport
  onResult(result: CollisionState): void
}

/** Iterações da busca binária pelo estado seguro mais próximo (resolução ~ faixa / 2^30). */
const GUARD_ITERATIONS = 30
/** Folga numérica (m) ao comparar penetrações. */
const SAFE_EPSILON_M = 1e-6

function lerp(from: number, to: number, fraction: number): number {
  return from + (to - from) * fraction
}

/** Passo máximo do teste varrido por comando (graus ou metros), para não atravessar objetos. */
const SWEEP_STEP: Record<keyof CraneState, number> = {
  turretRotationDeg: 0.5,
  boomAngleDeg: 0.25,
  boomLengthM: 0.05,
  cableLengthM: 0.05,
}
/** Teto de amostras por comando, para o custo de um salto enorme continuar limitado. */
const MAX_SWEEP_STEPS = 400

/**
 * Caminho do guindaste de `from` até `to` (dois estados já na faixa), como função da fração
 * percorrida (0 a 1), e o número de passos da varredura. Os campos andam juntos, em reta; o giro anda
 * `turretTravelDeg` (pelo menor ângulo, se o giro for contínuo) e cada ponto volta à faixa só depois
 * de interpolado (TASK-092).
 */
function pathBetween(
  from: CraneState,
  to: CraneState,
  turretRange: TurretRange,
): { readonly at: (fraction: number) => CraneState; readonly steps: number } {
  const turretTravel = turretTravelDeg(from.turretRotationDeg, to.turretRotationDeg, turretRange)
  const at = (fraction: number): CraneState =>
    fraction >= 1
      ? to
      : {
          turretRotationDeg: fitTurretToRange(
            from.turretRotationDeg + turretTravel * fraction,
            turretRange,
          ),
          boomAngleDeg: lerp(from.boomAngleDeg, to.boomAngleDeg, fraction),
          boomLengthM: lerp(from.boomLengthM, to.boomLengthM, fraction),
          cableLengthM: lerp(from.cableLengthM, to.cableLengthM, fraction),
        }
  const steps = Math.min(
    MAX_SWEEP_STEPS,
    Math.max(
      Math.ceil(Math.abs(turretTravel) / SWEEP_STEP.turretRotationDeg),
      Math.ceil(Math.abs(to.boomAngleDeg - from.boomAngleDeg) / SWEEP_STEP.boomAngleDeg),
      Math.ceil(Math.abs(to.boomLengthM - from.boomLengthM) / SWEEP_STEP.boomLengthM),
      Math.ceil(Math.abs(to.cableLengthM - from.cableLengthM) / SWEEP_STEP.cableLengthM),
    ),
  )
  return { at, steps }
}

/**
 * Comandos do guindaste que continuam valendo quando o modelo 3D da cena é trocado (TASK-041): a UI
 * recebe este objeto uma vez só, e ele repassa tudo ao `CraneController` do rig atual.
 *
 * Na troca (`switchTo`), o controller novo nasce com os mesmos limites e parâmetros a e h (os da ficha
 * técnica, nunca do modelo; RN-003) e com o estado atual, então o guindaste novo aparece na mesma
 * pose. A geometria operacional não muda com a troca (ADR-013 C-7).
 */
export class SwitchableCrane implements CraneCommands {
  private controller: CraneController
  private afterCommand: (() => void) | null = null
  private guard: CollisionGuard | null = null
  private appliedListener: (() => void) | null = null

  constructor(controller: CraneController) {
    this.controller = controller
  }

  get limits(): CraneLimits {
    return this.controller.limits
  }

  get geometryParameters(): CraneGeometryParameters {
    return this.controller.geometryParameters
  }

  /** Controller do rig desenhado agora. */
  get current(): CraneController {
    return this.controller
  }

  /**
   * Passa a comandar `rig`, na pose atual. `afterCommand` roda depois de cada comando (e uma vez já
   * na troca), para peças que só acompanham o movimento, como o cilindro de levantamento do GLB.
   */
  switchTo(rig: CraneRig, afterCommand?: () => void): CraneController {
    this.controller = new CraneController(
      rig,
      this.controller.limits,
      this.controller.geometryParameters,
      this.controller.getState(),
    )
    this.afterCommand = afterCommand ?? null
    this.afterCommand?.()
    return this.controller
  }

  getState(): CraneState {
    return this.controller.getState()
  }

  /**
   * Avisa depois de cada comando aplicado (TASK-074): o tandem usa para o guindaste que acompanha
   * seguir o que conduz. `null` desliga.
   */
  setAppliedListener(listener: (() => void) | null): void {
    this.appliedListener = listener
  }

  /**
   * Aplica um estado inteiro sem passar pela guarda de colisões nem avisar o `appliedListener`
   * (TASK-074): quem chama (o tandem) já avaliou o estado. Os valores continuam limitados à ficha.
   */
  applyUnguarded(state: CraneState): void {
    this.controller.setTurretRotation(state.turretRotationDeg)
    this.controller.setBoomAngle(state.boomAngleDeg)
    this.controller.setBoomLength(state.boomLengthM)
    this.controller.setCableLength(state.cableLengthM)
    this.afterCommand?.()
  }

  getOperationalGeometry(): OperationalGeometry {
    return this.controller.getOperationalGeometry()
  }

  /**
   * Liga (ou desliga, com `null`) a guarda de colisões. Com ela, um comando que levaria a carga a
   * colidir no caminho ou no fim é cortado no último estado seguro do caminho (varredura em passos
   * pequenos e busca binária entre o último passo seguro e o primeiro inseguro), e o resultado é
   * sinalizado. Se o estado de antes já colide (o cenário mudou sob o guindaste), os comandos passam
   * sem corte, para a pessoa poder sair dali; o estado segue sinalizado.
   */
  setCollisionGuard(guard: CollisionGuard | null): void {
    this.guard = guard
    this.revalidate()
  }

  /** Reavalia o estado atual (cenário, carga ou modelo mudaram) e avisa a guarda. */
  revalidate(): void {
    if (!this.guard) return
    const report = this.guard.evaluate(this.controller.getState())
    this.guard.onResult({ ...report, blocked: false })
  }

  setTurretRotation(deg: number): number {
    return this.command('turretRotationDeg', deg, (v) => this.controller.setTurretRotation(v))
  }

  setBoomAngle(deg: number): number {
    return this.command('boomAngleDeg', deg, (v) => this.controller.setBoomAngle(v))
  }

  setBoomLength(m: number): number {
    return this.command('boomLengthM', m, (v) => this.controller.setBoomLength(v))
  }

  setCableLength(m: number): number {
    return this.command('cableLengthM', m, (v) => this.controller.setCableLength(v))
  }

  /**
   * Aplica um estado inteiro de uma vez (reprodução de gravação e trajetória planejada). Guardado
   * (padrão): confere o caminho do estado anterior até o pedido, com os mesmos passos de varredura
   * do comando de um eixo (TASK-092), e, se algum ponto colidir, recua todos os campos juntos ao
   * último estado seguro desse caminho. O giro contínuo vai pelo menor ângulo. Sem guarda
   * (`guarded: false`): aplica como veio e só reavalia uma vez, para os destaques de colisão.
   */
  setState(state: Partial<CraneState>, options: { readonly guarded?: boolean } = {}): CraneState {
    const guard = this.guard
    if (!guard) {
      const applied = this.controller.setState(state)
      this.run(0)
      return applied
    }
    if (options.guarded === false) {
      const applied = this.controller.setState(state)
      this.run(0)
      guard.onResult({ ...guard.evaluate(applied), blocked: false })
      return applied
    }

    const previous = this.controller.getState()
    const previousReport = guard.evaluate(previous)
    return this.guardedMove(guard, previous, previousReport, this.controller.setState(state))
  }

  private command(key: keyof CraneState, value: number, apply: (v: number) => number): number {
    const guard = this.guard
    if (!guard) return this.run(apply(value))

    const previous = this.controller.getState()
    const previousReport = guard.evaluate(previous)
    apply(value)
    return this.guardedMove(guard, previous, previousReport, this.controller.getState())[key]
  }

  /**
   * Guarda de colisões de um movimento já aplicado no controller (`proposedState`). Movimento
   * varrido: um salto grande (slider, ou um quadro longo da trajetória) não pode atravessar um
   * obstáculo fino, então o caminho desde `previous` é testado em passos pequenos e para no primeiro
   * estado inseguro (TASK-063; TASK-092). Recusado, aplica o ponto seguro mais próximo do primeiro
   * inseguro (busca binária) e sinaliza o bloqueio.
   */
  private guardedMove(
    guard: CollisionGuard,
    previous: CraneState,
    previousReport: CollisionReport,
    proposedState: CraneState,
  ): CraneState {
    // Estado de partida já colidindo (o cenário mudou sob o guindaste): só se aceita o que não
    // aumenta a penetração, para dar para sair dali (ex.: subir o cabo).
    const limit = previousReport.hits.length === 0 ? 0 : previousReport.penetrationM
    const isSafe = (report: CollisionReport): boolean =>
      report.hits.length === 0 || report.penetrationM <= limit + SAFE_EPSILON_M
    const proposed = guard.evaluate(proposedState)

    const { at, steps } = pathBetween(
      previous,
      proposedState,
      this.controller.limits.turretRotationDeg,
    )
    let lastSafe = 0
    let firstUnsafe: number | null = null
    let firstUnsafeReport: CollisionReport | null = null
    for (let i = 1; i < steps; i++) {
      const fraction = i / steps
      const report = guard.evaluate(at(fraction))
      if (!isSafe(report)) {
        firstUnsafe = fraction
        firstUnsafeReport = report
        break
      }
      lastSafe = fraction
    }

    if (firstUnsafe === null && isSafe(proposed)) {
      this.run(0)
      guard.onResult({ ...proposed, blocked: false })
      return proposedState
    }

    // Recusado: busca, entre o último passo seguro e o primeiro inseguro, o mais próximo do pedido.
    const blockedReport = firstUnsafeReport ?? proposed
    let safe = lastSafe
    let unsafe = firstUnsafe ?? 1
    for (let i = 0; i < GUARD_ITERATIONS; i++) {
      const middle = (safe + unsafe) / 2
      if (isSafe(guard.evaluate(at(middle)))) safe = middle
      else unsafe = middle
    }
    const final = this.controller.setState(at(safe))
    this.run(0)
    const after = guard.evaluate(final)
    guard.onResult({
      hits: blockedReport.hits,
      alerts: after.alerts,
      penetrationM: blockedReport.penetrationM,
      blocked: true,
    })
    return final
  }

  private run(applied: number): number {
    this.afterCommand?.()
    this.appliedListener?.()
    return applied
  }
}
