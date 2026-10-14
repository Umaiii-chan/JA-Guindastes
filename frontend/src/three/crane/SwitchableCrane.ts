import type {
  CraneGeometryParameters,
  OperationalGeometry,
} from '../../domain/geometry/operationalGeometry'
import type { CollisionReport, CollisionState } from '../../domain/collision/collisions'
import { CraneController, type CraneRig } from './CraneController'
import type { CraneCommands, CraneLimits, CraneState } from './types'

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

/**
 * Comandos do guindaste que continuam valendo quando o modelo 3D da cena é trocado (TASK-041): a UI
 * recebe este objeto uma vez só, e ele repassa tudo ao `CraneController` do rig atual.
 *
 * Na troca (`switchTo`), o controller novo nasce com os mesmos limites e parâmetros a e h (os da ficha
 * técnica, nunca do modelo; RN-003) e com o estado atual, então o guindaste novo aparece na mesma
 * pose. A geometria operacional não muda com a troca (ADR-013 C-7).
 */
/** Passo máximo do teste varrido por comando (graus ou metros), para não atravessar objetos. */
const SWEEP_STEP: Record<keyof CraneState, number> = {
  turretRotationDeg: 0.5,
  boomAngleDeg: 0.25,
  boomLengthM: 0.05,
  cableLengthM: 0.05,
}
const MAX_SWEEP_STEPS = 400

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
   * colidir é cortado no estado seguro mais próximo, por busca binária entre o valor anterior (seguro)
   * e o pedido, e o resultado é sinalizado. Se o estado de antes já colide (o cenário mudou sob o
   * guindaste), os comandos passam sem corte, para a pessoa poder sair dali; o estado segue sinalizado.
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
   * (padrão): checa a colisão só no estado final e, se ele colidir, recua todos os campos juntos ao
   * último estado seguro entre o anterior e o pedido (busca binária na reta). Sem guarda
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
    const limit = previousReport.hits.length === 0 ? 0 : previousReport.penetrationM
    const isSafe = (report: CollisionReport): boolean =>
      report.hits.length === 0 || report.penetrationM <= limit + SAFE_EPSILON_M
    const proposedState = this.controller.setState(state)
    const proposed = guard.evaluate(proposedState)
    if (isSafe(proposed)) {
      this.run(0)
      guard.onResult({ ...proposed, blocked: false })
      return proposedState
    }

    // Recusado: recua juntos todos os campos ao último ponto seguro da reta anterior -> pedido.
    const at = (fraction: number): CraneState => ({
      turretRotationDeg: lerp(
        previous.turretRotationDeg,
        proposedState.turretRotationDeg,
        fraction,
      ),
      boomAngleDeg: lerp(previous.boomAngleDeg, proposedState.boomAngleDeg, fraction),
      boomLengthM: lerp(previous.boomLengthM, proposedState.boomLengthM, fraction),
      cableLengthM: lerp(previous.cableLengthM, proposedState.cableLengthM, fraction),
    })
    let safe = 0
    let unsafe = 1
    for (let i = 0; i < GUARD_ITERATIONS; i++) {
      const middle = (safe + unsafe) / 2
      if (isSafe(guard.evaluate(at(middle)))) safe = middle
      else unsafe = middle
    }
    const final = this.controller.setState(at(safe))
    this.run(0)
    const after = guard.evaluate(final)
    guard.onResult({
      hits: proposed.hits,
      alerts: after.alerts,
      penetrationM: proposed.penetrationM,
      blocked: true,
    })
    return final
  }

  private command(key: keyof CraneState, value: number, apply: (v: number) => number): number {
    const guard = this.guard
    if (!guard) return this.run(apply(value))

    const previous = this.controller.getState()
    const previousReport = guard.evaluate(previous)
    // Estado de partida já colidindo (o cenário mudou sob o guindaste): só se aceita o que não
    // aumenta a penetração, para dar para sair dali (ex.: subir o cabo).
    const limit = previousReport.hits.length === 0 ? 0 : previousReport.penetrationM
    const isSafe = (report: CollisionReport): boolean =>
      report.hits.length === 0 || report.penetrationM <= limit + SAFE_EPSILON_M
    const applied = apply(value)
    const proposedState = this.controller.getState()
    const proposed = guard.evaluate(proposedState)

    // Movimento varrido: um salto grande do slider não pode atravessar um obstáculo fino. Testa o
    // caminho em passos pequenos e para no primeiro estado inseguro (TASK-063).
    const from = previous[key]
    const to = proposedState[key]
    const steps = Math.min(MAX_SWEEP_STEPS, Math.ceil(Math.abs(to - from) / SWEEP_STEP[key]))
    let lastSafe = from
    let firstUnsafe: number | null = null
    let firstUnsafeReport: CollisionReport | null = null
    for (let i = 1; i < steps; i++) {
      const sample = from + ((to - from) * i) / steps
      const report = guard.evaluate({ ...proposedState, [key]: sample })
      if (!isSafe(report)) {
        firstUnsafe = sample
        firstUnsafeReport = report
        break
      }
      lastSafe = sample
    }

    if (firstUnsafe === null && isSafe(proposed)) {
      this.run(applied)
      guard.onResult({ ...proposed, blocked: false })
      return applied
    }

    // Recusado: busca, entre o último passo seguro e o primeiro inseguro, o mais próximo do pedido.
    const blockedReport = firstUnsafeReport ?? proposed
    let safe = lastSafe
    let unsafe = firstUnsafe ?? to
    for (let i = 0; i < GUARD_ITERATIONS; i++) {
      const middle = (safe + unsafe) / 2
      if (isSafe(guard.evaluate({ ...proposedState, [key]: middle }))) safe = middle
      else unsafe = middle
    }
    const final = apply(safe)
    this.run(final)
    const after = guard.evaluate(this.controller.getState())
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
