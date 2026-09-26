import type {
  CraneGeometryParameters,
  OperationalGeometry,
} from '../../domain/geometry/operationalGeometry'
import { CraneController, type CraneRig } from './CraneController'
import type { CraneCommands, CraneLimits, CraneState } from './types'

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

  getOperationalGeometry(): OperationalGeometry {
    return this.controller.getOperationalGeometry()
  }

  setTurretRotation(deg: number): number {
    return this.run(this.controller.setTurretRotation(deg))
  }

  setBoomAngle(deg: number): number {
    return this.run(this.controller.setBoomAngle(deg))
  }

  setBoomLength(m: number): number {
    return this.run(this.controller.setBoomLength(m))
  }

  setCableLength(m: number): number {
    return this.run(this.controller.setCableLength(m))
  }

  private run(applied: number): number {
    this.afterCommand?.()
    return applied
  }
}
