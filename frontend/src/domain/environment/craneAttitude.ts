// Assentamento do guindaste no terreno (TASK-066; ADR-032), sem Three.js: altura sob o centro e
// inclinação pelo plano das quatro sapatas. Os macacos, com as patolas apoiadas, compensam a
// inclinação até `levelingDeg`; o que sobra aparece no modelo.

import { type CranePlacement, type TerrainSpec, terrainHeightAt } from './environment'

const DEG = Math.PI / 180

/** Sapatas FICTÍCIAS (ADR-012): meia distância ao longo do chassi e na transversal, em metros. */
export const SHOE_HALF_LENGTH_M = 3
export const SHOE_HALF_WIDTH_M = 2.5

/** Ordem das sapatas: dianteira esquerda, dianteira direita, traseira esquerda, traseira direita. */
export const SHOE_ORDER = ['fl', 'fr', 'rl', 'rr'] as const
export type ShoePosition = (typeof SHOE_ORDER)[number]

export interface ShoePoint {
  readonly position: ShoePosition
  readonly x: number
  readonly z: number
  readonly y: number
}

/**
 * Posição de cada sapata no mundo. No referencial do guindaste (girado por `headingDeg`, frente em
 * +Z), "esquerda" é -X e "direita" é +X, como em `footprintPlacement` (ADR-023).
 */
export function shoePoints(
  terrain: TerrainSpec,
  placement: CranePlacement,
  halfLengthM = SHOE_HALF_LENGTH_M,
  halfWidthM = SHOE_HALF_WIDTH_M,
): readonly ShoePoint[] {
  const heading = placement.headingDeg * DEG
  const cos = Math.cos(heading)
  const sin = Math.sin(heading)
  const corner = (position: ShoePosition, localX: number, localZ: number): ShoePoint => {
    const x = placement.x + localX * cos + localZ * sin
    const z = placement.z - localX * sin + localZ * cos
    return { position, x, z, y: terrainHeightAt(terrain, x, z) }
  }
  return [
    corner('fl', -halfWidthM, halfLengthM),
    corner('fr', halfWidthM, halfLengthM),
    corner('rl', -halfWidthM, -halfLengthM),
    corner('rr', halfWidthM, -halfLengthM),
  ]
}

export interface CraneAttitude {
  /** Altura do terreno sob o eixo de giro: onde o guindaste assenta. */
  readonly groundY: number
  /** Inclinação do plano das sapatas (graus, >= 0). */
  readonly terrainTiltDeg: number
  /** Inclinação que aparece no modelo, depois da compensação dos macacos (graus, >= 0). */
  readonly residualTiltDeg: number
  /**
   * Normal do chassi no referencial do guindaste (antes do rumo), unitária; `(0, 1, 0)` = nivelado.
   * É a normal do plano das sapatas, girada para a vertical na parte compensada pelos macacos.
   */
  readonly normal: { readonly x: number; readonly y: number; readonly z: number }
  readonly shoes: readonly ShoePoint[]
}

/**
 * Atitude do guindaste sobre o terreno. `levelingDeg` é a correção de nível efetivamente aplicada
 * (0 sem patolas apoiadas). Com `levelingDeg >= terrainTiltDeg`, o chassi fica nivelado.
 */
export function craneAttitude(
  terrain: TerrainSpec,
  placement: CranePlacement,
  levelingDeg = 0,
): CraneAttitude {
  const shoes = shoePoints(terrain, placement)
  const [fl, fr, rl, rr] = shoes as [ShoePoint, ShoePoint, ShoePoint, ShoePoint]
  const gradX = (fr.y + rr.y - fl.y - rl.y) / 2 / (2 * SHOE_HALF_WIDTH_M)
  const gradZ = (fl.y + fr.y - rl.y - rr.y) / 2 / (2 * SHOE_HALF_LENGTH_M)
  const gradient = Math.hypot(gradX, gradZ)
  const tilt = Math.atan(gradient) / DEG
  const groundY = terrainHeightAt(terrain, placement.x, placement.z)
  if (tilt < 1e-9) {
    return { groundY, terrainTiltDeg: 0, residualTiltDeg: 0, normal: { x: 0, y: 1, z: 0 }, shoes }
  }
  const residual = Math.max(0, tilt - Math.max(0, levelingDeg))
  // A normal do plano aponta contra o gradiente (para cima e para o lado que desce).
  const sin = Math.sin(residual * DEG)
  return {
    groundY,
    terrainTiltDeg: tilt,
    residualTiltDeg: residual,
    normal: {
      x: (-gradX / gradient) * sin,
      y: Math.cos(residual * DEG),
      z: (-gradZ / gradient) * sin,
    },
    shoes,
  }
}
