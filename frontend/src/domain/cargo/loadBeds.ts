// Superfícies onde a carga pode ser solta (TASK-101; ADR-046; TASK-108; ADR-052), sem Three.js: a
// superfície de apoio é o maior entre o terreno e o topo do `loadBed` de um objeto da biblioteca sob o
// centro da pegada da carga. Quem declara `loadBed`: o caminhão plataforma (carroceria), a carreta
// prancha (convés) e os contêineres (teto); qualquer objeto novo da biblioteca pode declarar o seu.
// Uma caixa comum (mesmo chamada "carreta") não recebe carga.
//
// Eixos da cena (ADR-013): Y para cima; X e Z no chão; metros e graus (RN-006).

import { mulVec, rotY } from '../collision/obb'
import { type Obstacle, type TerrainSpec, terrainHeightAt } from '../environment/environment'
import { findLibraryObject, NO_CAPACITY_SOURCE, scaledLoadBed } from '../environment/objectLibrary'

const DEG = Math.PI / 180
/** Tolerância (m²) do produto vetorial para um ponto na borda da carroceria contar como dentro. */
const EDGE_EPSILON = 1e-9

interface Point {
  readonly x: number
  readonly z: number
}

/** A superfície de apoio de um objeto no mundo: a planta (cantos), a altura do topo (m) e o que se sabe da capacidade. */
export interface LoadBed {
  readonly obstacleId: string
  /** `id` do objeto da biblioteca (`modelId` do obstáculo). */
  readonly modelId: string
  /** Nome do objeto da biblioteca, para os textos ("Contêiner 40' (ISO)"). */
  readonly objectLabel: string
  readonly corners: readonly Point[]
  readonly topY: number
  /** Capacidade (kg) de carga apoiada, SE houver dado; `undefined` = sem dado (FICTÍCIO). */
  readonly capacityKg?: number
  /** De onde vem a capacidade, ou o rótulo FICTÍCIO (`NO_CAPACITY_SOURCE`). */
  readonly capacitySource: string
}

/** As superfícies de apoio dos objetos que as declaram entre os obstáculos, com o topo na altura do terreno. */
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
    const info = object?.loadBedInfo
    beds.push({
      obstacleId: obstacle.id,
      modelId: obstacle.modelId ?? '',
      objectLabel: object?.label ?? '',
      corners,
      topY: ground + bed.y + bed.h,
      ...(info?.capacityKg !== undefined ? { capacityKg: info.capacityKg } : {}),
      capacitySource: info?.source ?? NO_CAPACITY_SOURCE,
    })
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

/** A carga pesa mais do que o apoio aguenta? Só com capacidade CONHECIDA; sem dado, não limita (apoio FICTÍCIO). */
export function exceedsCapacity(bed: LoadBed, weightKg: number): boolean {
  return bed.capacityKg !== undefined && weightKg > bed.capacityKg
}

/** Topo da superfície de apoio sob o centro da pegada da carga, ou `null` se não há nenhuma. */
export function loadBedTopUnder(center: Point, beds: readonly LoadBed[]): number | null {
  return loadBedUnder(center, beds)?.topY ?? null
}
