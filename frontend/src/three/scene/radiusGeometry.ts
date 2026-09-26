// Geometria do anel de raio e do arco de alcance no chão (TASK-041), sem Three.js.
//
// Tudo aqui é desenho de PRÉ-VISUALIZAÇÃO (ADR-013 C-7): o anel usa o raio de trabalho que o
// `CraneController` já calcula pelas fórmulas do ADR-013 C-5, e o arco de alcance aplica a fórmula (1)
// nas pontas das faixas dos comandos. Nada disso decide capacidade ou segurança (RN-008).
//
// Convenções do ADR-013 C-1/C-2: o anel fica no plano de apoio (y = 0), centrado no eixo de giro
// (x = z = 0), e a direção horizontal da lança com giro ψ é u(ψ) = (sin ψ, 0, cos ψ).

import type { CraneGeometryParameters } from '../../domain/geometry/operationalGeometry'
import type { CraneLimits, NumericRange } from '../crane/types'

/** Ponto no plano do chão (m). */
export interface GroundPoint {
  readonly x: number
  readonly z: number
}

/** Faixa de raio de trabalho alcançável (m), já limitada a ≥ 0. */
export interface ReachRange {
  readonly minM: number
  readonly maxM: number
}

/** Faixa de giro desenhada, em graus; `full` quando cobre a volta inteira. */
export interface TurretSweep {
  readonly startDeg: number
  readonly endDeg: number
  readonly full: boolean
}

const DEG = Math.PI / 180

/** Direção horizontal da lança com giro ψ (ADR-013 C-2): u(ψ) = (sin ψ, cos ψ) no plano XZ. */
export function boomDirection(turretRotationDeg: number): GroundPoint {
  const psi = turretRotationDeg * DEG
  return { x: Math.sin(psi), z: Math.cos(psi) }
}

/** Ponto do chão a `radiusM` do eixo de giro, na direção da lança com giro ψ. */
export function pointAtRadius(radiusM: number, turretRotationDeg: number): GroundPoint {
  const u = boomDirection(turretRotationDeg)
  return { x: radiusM * u.x, z: radiusM * u.z }
}

/** Menor e maior cos θ na faixa de θ (°). cos é máximo em 0° e, em [−90°, 90°], mínimo nas pontas. */
function cosineRange(boomAngleDeg: NumericRange): { min: number; max: number } {
  const atMin = Math.cos(boomAngleDeg.min * DEG)
  const atMax = Math.cos(boomAngleDeg.max * DEG)
  const includesZero = boomAngleDeg.min <= 0 && boomAngleDeg.max >= 0
  return { min: Math.min(atMin, atMax), max: includesZero ? 1 : Math.max(atMin, atMax) }
}

/**
 * Raio mínimo e máximo alcançáveis com as faixas de θ e L, pela fórmula (1) R = a + L·cos θ
 * (ADR-013 C-5). O raio de trabalho não existe com R < 0 (C-5), então os dois ficam limitados a ≥ 0.
 * Supõe θ dentro de [−90°, 90°], como toda lança telescópica.
 */
export function computeReachRange(
  limits: Pick<CraneLimits, 'boomAngleDeg' | 'boomLengthM'>,
  geometry: CraneGeometryParameters,
): ReachRange {
  const cos = cosineRange(limits.boomAngleDeg)
  const { min: lengthMin, max: lengthMax } = limits.boomLengthM
  const a = geometry.boomPivotOffsetM
  const smallest = a + (cos.min >= 0 ? lengthMin : lengthMax) * cos.min
  const largest = a + (cos.max >= 0 ? lengthMax : lengthMin) * cos.max
  return { minM: Math.max(0, smallest), maxM: Math.max(0, largest) }
}

/** Faixa de giro da torre a desenhar; volta inteira quando a faixa cobre 360° ou mais. */
export function computeTurretSweep(turretRotationDeg: NumericRange): TurretSweep {
  const span = turretRotationDeg.max - turretRotationDeg.min
  if (span >= 360) return { startDeg: 0, endDeg: 360, full: true }
  return { startDeg: turretRotationDeg.min, endDeg: turretRotationDeg.max, full: false }
}

/**
 * Pontos de um arco de raio `radiusM` no chão, de `startDeg` a `endDeg` (giro ψ do ADR-013), com
 * `segments` trechos (`segments + 1` pontos, o último igual ao primeiro numa volta inteira).
 */
export function arcPoints(
  radiusM: number,
  startDeg: number,
  endDeg: number,
  segments: number,
): GroundPoint[] {
  const count = Math.max(1, Math.round(segments))
  const points: GroundPoint[] = []
  for (let index = 0; index <= count; index += 1) {
    const psi = startDeg + ((endDeg - startDeg) * index) / count
    points.push(pointAtRadius(radiusM, psi))
  }
  return points
}

/** Quantos trechos usar num arco para ele parecer liso: ~1 a cada 2°, entre 8 e 256. */
export function arcSegments(startDeg: number, endDeg: number): number {
  return Math.min(256, Math.max(8, Math.ceil(Math.abs(endDeg - startDeg) / 2)))
}

/** Texto do rótulo do anel: `R 8,63 m`, com duas casas no formato pt-BR, como no painel de geometria. */
export function formatRadiusLabel(radiusM: number): string {
  const value = radiusM.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `R ${value} m`
}

/** Distância (m) do anel até o rótulo, para fora, para o texto não cobrir a linha. */
export const RADIUS_LABEL_OFFSET_M = 1.2

/** Onde fica o rótulo: um pouco além do anel, na direção da lança. */
export function radiusLabelPosition(radiusM: number, turretRotationDeg: number): GroundPoint {
  return pointAtRadius(radiusM + RADIUS_LABEL_OFFSET_M, turretRotationDeg)
}
