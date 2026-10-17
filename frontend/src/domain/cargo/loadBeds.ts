// Carroceria onde a carga pode ser solta (TASK-101; ADR-046), sem Three.js: a superfície de apoio
// é o maior entre o terreno e o topo da carroceria de um caminhão plataforma da biblioteca
// (`loadBed`) sob a pegada da carga. Outros objetos de topo plano não recebem carga (pendência).
//
// Eixos da cena (ADR-013): Y para cima; X e Z no chão; metros e graus (RN-006).

import { mulVec, rotY } from '../collision/obb'
import { type Obstacle, type TerrainSpec, terrainHeightAt } from '../environment/environment'
import { findLibraryObject, scaledLoadBed } from '../environment/objectLibrary'

const DEG = Math.PI / 180
/** Sobreposição (m) abaixo da qual a pegada só encosta na carroceria e não se apoia nela. */
const MIN_OVERLAP_M = 1e-6

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

/** Projeção (min, max) de um polígono convexo sobre um eixo. */
function project(corners: readonly Point[], axis: Point): [number, number] {
  const values = corners.map((corner) => corner.x * axis.x + corner.z * axis.z)
  return [Math.min(...values), Math.max(...values)]
}

/** Dois retângulos (cantos em ordem) se sobrepõem com área? Eixo separador: teorema dos eixos. */
export function rectsOverlap(a: readonly Point[], b: readonly Point[]): boolean {
  for (const polygon of [a, b]) {
    for (let index = 0; index < polygon.length; index += 1) {
      const from = polygon[index] as Point
      const to = polygon[(index + 1) % polygon.length] as Point
      const length = Math.hypot(to.x - from.x, to.z - from.z)
      if (length === 0) continue
      const axis = { x: -(to.z - from.z) / length, z: (to.x - from.x) / length }
      const [minA, maxA] = project(a, axis)
      const [minB, maxB] = project(b, axis)
      if (Math.min(maxA, maxB) - Math.max(minA, minB) <= MIN_OVERLAP_M) return false
    }
  }
  return true
}

/** A carroceria mais alta sob a pegada (cantos da base da carga), ou `null` se não há nenhuma. */
export function loadBedUnder(
  footprint: readonly Point[],
  beds: readonly LoadBed[],
): LoadBed | null {
  let found: LoadBed | null = null
  for (const bed of beds) {
    if (!rectsOverlap(footprint, bed.corners)) continue
    if (found === null || bed.topY > found.topY) found = bed
  }
  return found
}

/** Maior topo de carroceria sob a pegada (cantos da base da carga), ou `null` se não há nenhuma. */
export function loadBedTopUnder(
  footprint: readonly Point[],
  beds: readonly LoadBed[],
): number | null {
  return loadBedUnder(footprint, beds)?.topY ?? null
}
