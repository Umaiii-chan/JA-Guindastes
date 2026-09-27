// Predefinições de câmera e limites da órbita (TASK-041), sem Three.js: a UI pode importar os tipos.
//
// Os enquadramentos usam a geometria de PRÉ-VISUALIZAÇÃO do `CraneController` (ADR-013 C-5) só para
// apontar a câmera; não mexem na cinemática nem no cálculo.

import type { OperationalGeometry } from '../../domain/geometry/operationalGeometry'

/** Predefinições de câmera da cena. */
export type CameraPreset = 'perspectiva' | 'lateral' | 'topo' | 'operador'

export const CAMERA_PRESETS: readonly CameraPreset[] = [
  'perspectiva',
  'lateral',
  'topo',
  'operador',
]

export interface Vec3 {
  readonly x: number
  readonly y: number
  readonly z: number
}

/** Posição da câmera e ponto para onde ela olha (o alvo da órbita), em metros. */
export interface CameraView {
  readonly position: Vec3
  readonly target: Vec3
}

/** O que os enquadramentos precisam saber do guindaste. */
export interface CameraFraming {
  readonly turretRotationDeg: number
  readonly geometry: Pick<OperationalGeometry, 'workingRadiusM' | 'tipHeightM' | 'hook'>
  /** Maior raio alcançável (m), para enquadrar a lança toda estendida. */
  readonly maxReachM: number
  /**
   * Olho do operador no referencial da base com ψ = 0 (m), medido no modelo em uso (vidro da cabine
   * da torre). Sem ele, vale `OPERATOR_EYE_LOCAL`, do modelo provisório.
   */
  readonly operatorEye?: Vec3
}

/** Limites da órbita: distância ao alvo e altura mínima da câmera acima do chão (y = 0). */
export const CAMERA_LIMITS = Object.freeze({
  minDistanceM: 4,
  maxDistanceM: 160,
  /** A câmera nunca desce abaixo disto, para não atravessar o chão. */
  minHeightM: 0.4,
  /** Ângulo polar máximo (a partir do zênite) mesmo com o alvo alto: nunca olha 100% para cima. */
  maxPolarAngleRad: Math.PI * 0.92,
})

/** Duração da transição entre predefinições (ms); zero com `prefers-reduced-motion`. */
export const CAMERA_TRANSITION_MS = 700

/** Enquadramento de referência: o da PoC, feito para uma lança de até ~20 m. */
const REFERENCE_REACH_M = 20
const PERSPECTIVE_POSITION: Vec3 = { x: 22, y: 13, z: 28 }
const PERSPECTIVE_TARGET: Vec3 = { x: 0, y: 7, z: 3 }

/**
 * Olho do operador no modelo PROVISÓRIO (m, referencial da base com ψ = 0): logo acima da cabine da
 * torre, que fica do lado +X (`createProvisionalCrane`). Com o GLB real, virá de um nó do modelo.
 */
export const OPERATOR_EYE_LOCAL: Vec3 = { x: 1.4, y: 3.2, z: 0.4 }

const DEG = Math.PI / 180

/** Gira `point` em torno do eixo Y por ψ, como `rotation.y` da torre (ADR-013 C-2). */
export function rotateAroundY(point: Vec3, turretRotationDeg: number): Vec3 {
  const psi = turretRotationDeg * DEG
  const cos = Math.cos(psi)
  const sin = Math.sin(psi)
  return { x: point.x * cos + point.z * sin, y: point.y, z: -point.x * sin + point.z * cos }
}

function scale(point: Vec3, factor: number): Vec3 {
  return { x: point.x * factor, y: point.y * factor, z: point.z * factor }
}

/**
 * Enquadramento de cada predefinição:
 * - `perspectiva`: vista 3/4 da PoC, afastada na proporção do alcance máximo;
 * - `lateral`: perpendicular ao plano da lança (vê θ, o raio e as alturas de lado);
 * - `topo`: de cima, com o anel de raio inteiro no quadro;
 * - `operador`: do olho do operador na torre, olhando para o gancho.
 */
export function resolveCameraPreset(preset: CameraPreset, framing: CameraFraming): CameraView {
  const reach = Math.max(framing.maxReachM, 1)
  const radius = Math.max(framing.geometry.workingRadiusM ?? 0, 0)
  const psi = framing.turretRotationDeg * DEG
  const along = { x: Math.sin(psi), z: Math.cos(psi) }

  switch (preset) {
    case 'lateral': {
      // Lado direito da lança: n = u(ψ) girado −90° em Y.
      const side = { x: Math.cos(psi), z: -Math.sin(psi) }
      const height = Math.max(framing.geometry.tipHeightM, 2)
      const target: Vec3 = { x: (along.x * radius) / 2, y: height / 2, z: (along.z * radius) / 2 }
      const distance = clampDistance(Math.max(reach, height) * 1.5 + 8)
      return {
        position: {
          x: target.x + side.x * distance,
          y: target.y + distance * 0.08,
          z: target.z + side.z * distance,
        },
        target,
      }
    }
    case 'topo': {
      const target: Vec3 = { x: 0, y: 0, z: 0 }
      const height = clampDistance(reach * 2.6 + 6)
      // Um desvio mínimo em Z mantém a orientação (+Z para baixo na tela) bem definida.
      return { position: { x: 0, y: height, z: height * 0.001 }, target }
    }
    case 'operador': {
      const eye = rotateAroundY(
        framing.operatorEye ?? OPERATOR_EYE_LOCAL,
        framing.turretRotationDeg,
      )
      const hook = framing.geometry.hook
      return { position: eye, target: { x: hook.xM, y: Math.max(hook.yM, 0), z: hook.zM } }
    }
    case 'perspectiva':
    default: {
      const factor = Math.max(1, reach / REFERENCE_REACH_M)
      return { position: scale(PERSPECTIVE_POSITION, factor), target: PERSPECTIVE_TARGET }
    }
  }
}

function clampDistance(distance: number): number {
  return Math.min(CAMERA_LIMITS.maxDistanceM, Math.max(CAMERA_LIMITS.minDistanceM, distance))
}

/**
 * Maior ângulo polar (a partir do zênite) que mantém a câmera a pelo menos `minHeightM` do chão,
 * orbitando a `distance` de um alvo na altura `targetY`: y = targetY + distance·cos(polar) ≥ minHeightM.
 * Com o alvo alto, a câmera pode olhar um pouco para cima (vista do operador); com o alvo no chão,
 * fica acima do plano do alvo. Nunca passa de `CAMERA_LIMITS.maxPolarAngleRad`.
 */
export function maxPolarAngleAboveGround(
  targetY: number,
  distance: number,
  minHeightM: number = CAMERA_LIMITS.minHeightM,
): number {
  if (!(distance > 0)) return Math.PI / 2
  const cosine = Math.min(1, Math.max(-1, (minHeightM - targetY) / distance))
  return Math.min(CAMERA_LIMITS.maxPolarAngleRad, Math.acos(cosine))
}

/** A câmera da vista fica acima do chão e dentro dos limites de distância? */
export function isViewWithinLimits(view: CameraView): boolean {
  const dx = view.position.x - view.target.x
  const dy = view.position.y - view.target.y
  const dz = view.position.z - view.target.z
  const distance = Math.hypot(dx, dy, dz)
  return (
    view.position.y >= CAMERA_LIMITS.minHeightM &&
    view.target.y >= 0 &&
    distance >= CAMERA_LIMITS.minDistanceM &&
    distance <= CAMERA_LIMITS.maxDistanceM
  )
}
