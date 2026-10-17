// Carroceria onde a carga pode ser solta (TASK-101; ADR-046), sem Three.js: a superfície de apoio
// é o maior entre o terreno e o topo da carroceria de um caminhão plataforma da biblioteca
// (`loadBed`) sob o centro da pegada da carga. Outros objetos de topo plano não recebem carga (pendência).
//
// Eixos da cena (ADR-013): Y para cima; X e Z no chão; metros e graus (RN-006).

import { mulVec, rotY } from '../collision/obb'
import { type Obstacle, type TerrainSpec, terrainHeightAt } from '../environment/environment'
import { findLibraryObject, scaledLoadBed } from '../environment/objectLibrary'

const DEG = Math.PI / 180
/** Tolerância (m²) do produto vetorial para um ponto na borda da carroceria contar como dentro. */
const EDGE_EPSILON = 1e-9

interface Point {
  readonly x: number
  readonly z: number
}

/** A carroceria de um caminhão no mundo: a planta (cantos) e a altura do topo (m). */
export interface LoadBed {
  readonly obstacleId: string
  readonly corners: readonly Point[]
  readonly topY: number
}

/** As carrocerias dos caminhões plataforma entre os obstáculos, com o topo na altura do terreno. */
export function loadBedsOf(
  obstacles: readonly Obstacle[],
  terrain: TerrainSpec,
): readonly LoadBed[] {
  const beds: LoadBed[] = []
  for (const obstacle of obstacles) {
    if (obstacle.kind !== 'model') continue
    const object = findLibraryObject(obstacle.modelId)
    const bed = object ? scaledLoadBed(obstacle, object) : undefined
    if (!bed) continue
    const rot = rotY(obstacle.rotationYDeg * DEG)
    const corners = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].map(([sx, sz]) => {
      const world = mulVec(rot, {
        x: bed.x + (sx as number) * (bed.w / 2),
        y: 0,
        z: bed.z + (sz as number) * (bed.d / 2),
      })
      return { x: obstacle.centerX + world.x, z: obstacle.centerZ + world.z }
    })
    const ground = terrainHeightAt(terrain, obstacle.centerX, obstacle.centerZ)
    beds.push({ obstacleId: obstacle.id, corners, topY: ground + bed.y + bed.h })
  }
  return beds
}

/** O ponto está dentro do retângulo (cantos em ordem)? Borda conta como dentro. */
export function pointInRect(point: Point, corners: readonly Point[]): boolean {
  let sign = 0
  for (let index = 0; index < corners.length; index += 1) {
    const from = corners[index] as Point
    const to = corners[(index + 1) % corners.length] as Point
    const cross = (to.x - from.x) * (point.z - from.z) - (to.z - from.z) * (point.x - from.x)
    if (Math.abs(cross) <= EDGE_EPSILON) continue
    const side = Math.sign(cross)
    if (sign === 0) sign = side
    else if (side !== sign) return false
  }
  return true
}

/**
 * A carroceria mais alta sob o centro da pegada da carga, ou `null` se o centro não cai em nenhuma
 * (TASK-103; ADR-046): só então a carga se apoia nela; senão vale o terreno.
 */
export function loadBedUnder(center: Point, beds: readonly LoadBed[]): LoadBed | null {
  let found: LoadBed | null = null
  for (const bed of beds) {
    if (!pointInRect(center, bed.corners)) continue
    if (found === null || bed.topY > found.topY) found = bed
  }
  return found
}

/** Topo da carroceria sob o centro da pegada da carga, ou `null` se não há nenhuma. */
export function loadBedTopUnder(center: Point, beds: readonly LoadBed[]): number | null {
  return loadBedUnder(center, beds)?.topY ?? null
}
