import { MathUtils, type Object3D } from 'three'

import {
  calculateOperationalGeometry,
  type CraneGeometryParameters,
  type OperationalGeometry,
  validateCraneGeometryParameters,
} from '../../domain/geometry/operationalGeometry'
import type { CraneCommands, CraneLimits, CraneState, NumericRange } from './types'

/**
 * Nós do guindaste que o controller movimenta, na hierarquia
 * base → torre → lança → extensão → ponta → cabo → gancho.
 *
 * O rig segue as convenções do ADR-013 (C-1, C-2 e C-4, regra 4), para a imagem bater com o cálculo
 * de `getOperationalGeometry()`:
 *
 * - `base`: origem no ponto O, onde o eixo de giro encontra o plano de apoio; Y para cima e +Z para
 *   a frente do chassi (lado da cabine), como no glTF e no Three.js;
 * - `turret`: gira em torno do seu Y local, que coincide com o eixo de giro (x = z = 0 da base);
 * - `boom`: origem no pino do pé da lança P, a (0, h, a) da base com ψ = 0, e lança ao longo do
 *   seu +Z local. Pose de repouso (todos os comandos em zero): lança horizontal (θ = 0), apontando
 *   para +Z (ψ = 0) e toda recolhida;
 * - `boomExtension` desliza ao longo do +Z local da lança, e `boomTip` (ponto T) fica na ponta;
 * - `cable` pende no −Y local, com a linha de altura 1 escalada no Y; a origem de `hook` é o ponto
 *   de suspensão G.
 *
 * Se o rig não bater com os parâmetros a e h (por exemplo, um GLB mal calibrado), o erro é só
 * visual: o cálculo não lê a posição dos nós (ADR-013 C-4, regra 3; C-7).
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
 * Aplica os comandos do guindaste nos nós da cena, sempre dentro dos limites recebidos na construção,
 * e devolve a geometria operacional do estado atual para PRÉ-VISUALIZAÇÃO.
 *
 * Nunca decide capacidade ou segurança da operação (doc-fonte § 12.2; RN-003; RN-008). A geometria
 * de `getOperationalGeometry()` sai das fórmulas do ADR-013 com os parâmetros a e h recebidos na
 * construção (que, fora da PoC, vêm da ficha técnica no backend, nunca do modelo 3D); o valor oficial
 * é o do backend (ADR-013 C-7).
 */
export class CraneController implements CraneCommands {
  readonly limits: CraneLimits
  readonly geometryParameters: CraneGeometryParameters

  private readonly rig: CraneRig
  private state: CraneState

  constructor(
    rig: CraneRig,
    limits: CraneLimits,
    geometryParameters: CraneGeometryParameters,
    initialState: Partial<CraneState> = {},
  ) {
    validateLimits(limits, rig.boomRetractedLengthM)
    validateCraneGeometryParameters(geometryParameters)
    this.rig = rig
    this.limits = freezeLimits(limits)
    this.geometryParameters = Object.freeze({
      boomPivotOffsetM: geometryParameters.boomPivotOffsetM,
      boomPivotHeightM: geometryParameters.boomPivotHeightM,
    })
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

  /**
   * Raio de trabalho, alturas da ponta e do gancho e posições P, T e G do estado atual, pelas fórmulas
   * do ADR-013 C-5 (doc-fonte § 17.3). PRÉ-VISUALIZAÇÃO: não é fonte de verdade (ADR-013 C-7; RN-008).
   * Não lê a posição dos nós da cena.
   */
  getOperationalGeometry(): OperationalGeometry {
    return calculateOperationalGeometry(this.state, this.geometryParameters)
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

  /** Aplica de uma vez os campos informados (cada um limitado à faixa) e devolve o estado. */
  setState(state: Partial<CraneState>): CraneState {
    const next = {
      turretRotationDeg: this.clampTo(
        'turretRotationDeg',
        state.turretRotationDeg ?? this.state.turretRotationDeg,
      ),
      boomAngleDeg: this.clampTo('boomAngleDeg', state.boomAngleDeg ?? this.state.boomAngleDeg),
      boomLengthM: this.clampTo('boomLengthM', state.boomLengthM ?? this.state.boomLengthM),
      cableLengthM: this.clampTo('cableLengthM', state.cableLengthM ?? this.state.cableLengthM),
    }
    this.state = next
    this.applyTurretRotation()
    this.applyBoomAngle()
    this.applyBoomLength()
    this.applyCableLength()
    return { ...next }
  }

  private clampTo(key: LimitKey, value: number): number {
    if (!Number.isFinite(value)) {
      throw new RangeError(`${key}: valor precisa ser um número finito (recebido ${value}).`)
    }
    const { min, max } = this.limits[key]
    return MathUtils.clamp(value, min, max)
  }

  private applyTurretRotation(): void {
    // ADR-013 C-2: ψ gira em torno de +Y, com zero em +Z e positivo no sentido anti-horário visto de
    // cima. É o sentido positivo de `rotation.y`: a rotação de ψ em Y leva o +Z local da torre para
    // (sin ψ, 0, cos ψ) = u(ψ), a direção horizontal da lança.
    this.rig.turret.rotation.y = MathUtils.degToRad(this.state.turretRotationDeg)
  }

  private applyBoomAngle(): void {
    // ADR-013 C-2: θ = 0 é a lança horizontal e θ > 0 levanta a ponta. Com a lança ao longo do +Z
    // local, a rotação de −θ em X leva o +Z para (0, sin θ, cos θ).
    const radians = MathUtils.degToRad(this.state.boomAngleDeg)
    this.rig.boom.rotation.x = -radians
    // O cabo é filho da ponta; a rotação oposta o mantém pendendo na vertical (S-2) com qualquer θ.
    this.rig.cable.rotation.x = radians
  }

  private applyBoomLength(): void {
    // A ponta T fica a L do pino P ao longo do +Z local da lança (ADR-013 C-3).
    this.rig.boomExtension.position.z = this.state.boomLengthM - this.rig.boomRetractedLengthM
  }

  private applyCableLength(): void {
    // O gancho G fica c abaixo da ponta T (fórmula 3).
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
