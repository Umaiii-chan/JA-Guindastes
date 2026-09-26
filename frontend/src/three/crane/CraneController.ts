import { MathUtils, type Object3D } from 'three'

import type { CraneCommands, CraneLimits, CraneState, NumericRange } from './types'

/**
 * Nós do guindaste que o controller movimenta, na hierarquia
 * base → torre → lança → extensão → ponta → cabo → gancho.
 *
 * Pose de repouso esperada (do guindaste provisório; o GLB real ainda não existe, L-002): com todos
 * os comandos em zero, a lança fica horizontal ao longo do +Z local da torre, com pivô na origem do
 * nó `boom`; a extensão desliza ao longo do +Z local da lança; o cabo pende no −Y local do nó
 * `cable`, com a linha de altura 1 que é escalada no Y. Essa pose é só visual e não fixa nenhuma
 * convenção geométrica (ADR-013 está Proposto).
 */
export interface CraneRig {
  readonly base: Object3D
  readonly turret: Object3D
  readonly boom: Object3D
  readonly boomExtension: Object3D
  readonly boomTip: Object3D
  readonly cable: Object3D
  readonly cableLine: Object3D
  readonly hook: Object3D
  /** Comprimento da lança toda recolhida no modelo (m): a extensão fica em z = 0 nesse valor. */
  readonly boomRetractedLengthM: number
}

type LimitKey = keyof CraneLimits

const LIMIT_KEYS: readonly LimitKey[] = [
  'turretRotationDeg',
  'boomAngleDeg',
  'boomLengthM',
  'cableLengthM',
]

/**
 * Aplica os comandos do guindaste nos nós da cena, sempre dentro dos limites recebidos na construção.
 *
 * Só movimenta a representação visual: não calcula raio, altura nem capacidade e nunca decide
 * capacidade ou segurança da operação (doc-fonte § 12.2; RN-003; RN-008).
 */
export class CraneController implements CraneCommands {
  readonly limits: CraneLimits

  private readonly rig: CraneRig
  private state: CraneState

  constructor(rig: CraneRig, limits: CraneLimits, initialState: Partial<CraneState> = {}) {
    validateLimits(limits, rig.boomRetractedLengthM)
    this.rig = rig
    this.limits = freezeLimits(limits)
    this.state = {
      turretRotationDeg: this.clampTo('turretRotationDeg', initialState.turretRotationDeg ?? 0),
      boomAngleDeg: this.clampTo('boomAngleDeg', initialState.boomAngleDeg ?? 0),
      boomLengthM: this.clampTo('boomLengthM', initialState.boomLengthM ?? 0),
      cableLengthM: this.clampTo('cableLengthM', initialState.cableLengthM ?? 0),
    }
    this.applyTurretRotation()
    this.applyBoomAngle()
    this.applyBoomLength()
    this.applyCableLength()
  }

  getState(): CraneState {
    return { ...this.state }
  }

  setTurretRotation(deg: number): number {
    const value = this.clampTo('turretRotationDeg', deg)
    this.state = { ...this.state, turretRotationDeg: value }
    this.applyTurretRotation()
    return value
  }

  setBoomAngle(deg: number): number {
    const value = this.clampTo('boomAngleDeg', deg)
    this.state = { ...this.state, boomAngleDeg: value }
    this.applyBoomAngle()
    return value
  }

  setBoomLength(m: number): number {
    const value = this.clampTo('boomLengthM', m)
    this.state = { ...this.state, boomLengthM: value }
    this.applyBoomLength()
    return value
  }

  setCableLength(m: number): number {
    const value = this.clampTo('cableLengthM', m)
    this.state = { ...this.state, cableLengthM: value }
    this.applyCableLength()
    return value
  }

  private clampTo(key: LimitKey, value: number): number {
    if (!Number.isFinite(value)) {
      throw new RangeError(`${key}: valor precisa ser um número finito (recebido ${value}).`)
    }
    const { min, max } = this.limits[key]
    return MathUtils.clamp(value, min, max)
  }

  private applyTurretRotation(): void {
    this.rig.turret.rotation.y = MathUtils.degToRad(this.state.turretRotationDeg)
  }

  private applyBoomAngle(): void {
    // Com a lança ao longo do +Z, ângulo positivo levanta a ponta: rotação negativa em torno do X.
    const radians = MathUtils.degToRad(this.state.boomAngleDeg)
    this.rig.boom.rotation.x = -radians
    // O cabo é filho da ponta; a rotação oposta o mantém pendendo na vertical com qualquer ângulo.
    this.rig.cable.rotation.x = radians
  }

  private applyBoomLength(): void {
    this.rig.boomExtension.position.z = this.state.boomLengthM - this.rig.boomRetractedLengthM
  }

  private applyCableLength(): void {
    this.rig.cableLine.scale.y = this.state.cableLengthM
    this.rig.hook.position.y = -this.state.cableLengthM
  }
}

function validateLimits(limits: CraneLimits, boomRetractedLengthM: number): void {
  for (const key of LIMIT_KEYS) {
    validateRange(key, limits[key])
  }
  if (limits.cableLengthM.min < 0) {
    throw new RangeError('cableLengthM: o mínimo não pode ser negativo.')
  }
  if (limits.boomLengthM.min < boomRetractedLengthM) {
    throw new RangeError(
      `boomLengthM: o mínimo (${limits.boomLengthM.min}) é menor que a lança recolhida do modelo (${boomRetractedLengthM}).`,
    )
  }
}

function validateRange(key: LimitKey, range: NumericRange): void {
  if (!Number.isFinite(range.min) || !Number.isFinite(range.max) || range.min > range.max) {
    throw new RangeError(`${key}: faixa inválida [${range.min}, ${range.max}].`)
  }
}

function freezeLimits(limits: CraneLimits): CraneLimits {
  return Object.freeze({
    turretRotationDeg: Object.freeze({ ...limits.turretRotationDeg }),
    boomAngleDeg: Object.freeze({ ...limits.boomAngleDeg }),
    boomLengthM: Object.freeze({ ...limits.boomLengthM }),
    cableLengthM: Object.freeze({ ...limits.cableLengthM }),
  })
}
