// Quanto uma caixa entra no terreno (TASK-091; ADR-028 § 2; RN-012), sem Three.js.
//
// A carga, o gancho e a cadeia de acessórios só giram em torno de Y (o cabo pende na vertical, S-2):
// em cada ponto (x, z) da pegada, o ponto mais baixo da caixa está na face de baixo. Basta então
// comparar essa face com `terrainHeightAt`, numa grade de passo fixo (0,5 m, ADR-028) com teto no
// TOTAL de pontos. Antes, a superfície inteira era amostrada com no máximo 12 pontos por aresta: numa
// viga de 20 m o passo virava 1,8 m, e um monte de 1 m de raio entrava 1,5 m nela sem alerta (F-17).
//
// Uma feição mais estreita que o passo ainda caberia entre duas amostras, então entram também os picos
// analíticos de cada feição que toca a pegada: o ponto da pegada mais perto do centro de cada elevação,
// platô ou aplainamento (a altura delas só cai com a distância ao centro) e o topo de cada rampa (a
// borda alta e as laterais, recortadas pela pegada). A caixa inclinada (não acontece hoje) volta à
// amostragem da superfície inteira.

import { type TerrainFeature, type TerrainSpec, terrainHeightAt } from '../environment/environment'
import { gridCounts, MAX_SAMPLE_POINTS, type Obb, obbSurfacePoints } from './obb'

/** Passo da grade sob a caixa (m; ADR-028). */
export const TERRAIN_SAMPLE_STEP_M = 0.5

/** Altura (m) abaixo do terreno que ainda se aceita (ruído numérico): a busca binária para dentro dela. */
export const TERRAIN_TOLERANCE_M = 1e-4

const DEG = Math.PI / 180
/** Folga (m) para os pontos de uma rampa ficarem do lado de dentro dela, onde ela tem altura. */
const INSIDE_EPSILON_M = 1e-6
/** Quão perto de ±Y um eixo precisa estar para a caixa contar como em pé. */
const UPRIGHT_EPSILON = 1e-9

interface GroundPoint {
  readonly x: number
  readonly z: number
}

/** Retângulo no chão (plano XZ): centro, eixos unitários e meias-medidas ao longo deles. */
export interface GroundRect {
  readonly center: GroundPoint
  readonly u: GroundPoint
  readonly v: GroundPoint
  readonly halfU: number
  readonly halfV: number
}

/** Pegada e altura da face de baixo da caixa em pé; `null` se nenhum eixo dela é vertical. */
export function obbBottomFace(
  obb: Obb,
): { readonly rect: GroundRect; readonly bottomY: number } | null {
  const halves = [obb.half.x, obb.half.y, obb.half.z]
  const vertical = obb.axes.findIndex((axis) => Math.abs(axis.y) >= 1 - UPRIGHT_EPSILON)
  if (vertical < 0) return null
  const [first, second] = [0, 1, 2].filter((index) => index !== vertical) as [number, number]
  const u = obb.axes[first]
  const v = obb.axes[second]
  return {
    rect: {
      center: { x: obb.center.x, z: obb.center.z },
      u: { x: u.x, z: u.z },
      v: { x: v.x, z: v.z },
      halfU: halves[first] ?? 0,
      halfV: halves[second] ?? 0,
    },
    bottomY: obb.center.y - (halves[vertical] ?? 0),
  }
}

function toWorld(rect: GroundRect, du: number, dv: number): GroundPoint {
  return {
    x: rect.center.x + du * rect.u.x + dv * rect.v.x,
    z: rect.center.z + du * rect.u.z + dv * rect.v.z,
  }
}

function toRect(rect: GroundRect, point: GroundPoint): { du: number; dv: number } {
  const dx = point.x - rect.center.x
  const dz = point.z - rect.center.z
  return { du: dx * rect.u.x + dz * rect.u.z, dv: dx * rect.v.x + dz * rect.v.z }
}

/** Grade sobre o retângulo: passo `TERRAIN_SAMPLE_STEP_M`, cantos incluídos, no máximo `maxPoints`. */
export function groundGrid(rect: GroundRect, maxPoints = MAX_SAMPLE_POINTS): GroundPoint[] {
  const [countU = 2, countV = 2] = gridCounts(
    [2 * rect.halfU, 2 * rect.halfV],
    TERRAIN_SAMPLE_STEP_M,
    maxPoints,
  )
  const points: GroundPoint[] = []
  for (let i = 0; i < countU; i++) {
    const du = -rect.halfU + (2 * rect.halfU * i) / (countU - 1)
    for (let j = 0; j < countV; j++) {
      points.push(toWorld(rect, du, -rect.halfV + (2 * rect.halfV * j) / (countV - 1)))
    }
  }
  return points
}

/** Ponto do retângulo mais perto de `point` (o próprio ponto, se ele está dentro). */
function closestInRect(rect: GroundRect, point: GroundPoint): GroundPoint {
  const { du, dv } = toRect(rect, point)
  const clamp = (value: number, half: number) => Math.min(half, Math.max(-half, value))
  return toWorld(rect, clamp(du, rect.halfU), clamp(dv, rect.halfV))
}

/** Trecho do segmento `from`→`to` dentro do retângulo (recorte de Liang-Barsky), ou `null`. */
function clipToRect(
  rect: GroundRect,
  from: GroundPoint,
  to: GroundPoint,
): readonly [GroundPoint, GroundPoint] | null {
  const a = toRect(rect, from)
  const b = toRect(rect, to)
  let t0 = 0
  let t1 = 1
  const edges: readonly [number, number, number][] = [
    [a.du, b.du - a.du, rect.halfU],
    [a.dv, b.dv - a.dv, rect.halfV],
  ]
  for (const [start, delta, half] of edges) {
    if (Math.abs(delta) < 1e-12) {
      if (Math.abs(start) > half) return null
      continue
    }
    let enter = (-half - start) / delta
    let leave = (half - start) / delta
    if (enter > leave) [enter, leave] = [leave, enter]
    t0 = Math.max(t0, enter)
    t1 = Math.min(t1, leave)
    if (t0 > t1) return null
  }
  const at = (t: number): GroundPoint => ({
    x: from.x + (to.x - from.x) * t,
    z: from.z + (to.z - from.z) * t,
  })
  return [at(t0), at(t1)]
}

/**
 * Onde uma rampa é mais alta dentro do retângulo. Ela sobe por igual no sentido da direção, então o
 * máximo fica num vértice do recorte: na borda alta, ou na ponta mais alta de uma lateral (os cantos
 * do retângulo já estão na grade). Os pontos ficam um fio para dentro da rampa, onde ela tem altura.
 */
function rampPeaks(feature: TerrainFeature, rect: GroundRect, out: GroundPoint[]): void {
  const angle = (feature.directionDeg ?? 0) * DEG
  // Mesmos eixos de `featureHeight`: along = dx·cos − dz·sin; across = dx·sin + dz·cos.
  const along = { x: Math.cos(angle), z: -Math.sin(angle) }
  const across = { x: Math.sin(angle), z: Math.cos(angle) }
  const top = Math.max(0, feature.radiusM - INSIDE_EPSILON_M)
  const side = Math.max(0, (feature.widthM ?? feature.radiusM) / 2 - INSIDE_EPSILON_M)
  const point = (a: number, c: number): GroundPoint => ({
    x: feature.centerX + a * along.x + c * across.x,
    z: feature.centerZ + a * along.z + c * across.z,
  })
  const highEdge = clipToRect(rect, point(top, -side), point(top, side))
  if (highEdge) out.push(...highEdge)
  for (const c of [-side, side]) {
    // Recorte da lateral de baixo para cima: o segundo ponto é o mais alto dentro do retângulo.
    const clipped = clipToRect(rect, point(-top, c), point(top, c))
    if (clipped) out.push(clipped[1])
  }
}

/** Pontos onde as feições do terreno têm o pico dentro do retângulo (TASK-091; F-17). */
export function terrainPeaks(terrain: TerrainSpec, rect: GroundRect): GroundPoint[] {
  const out: GroundPoint[] = []
  for (const feature of terrain.features) {
    if (!(feature.radiusM > 0)) continue
    switch (feature.kind) {
      case 'mound':
      case 'plateau':
      case 'flatten': {
        const center = { x: feature.centerX, z: feature.centerZ }
        const nearest = closestInRect(rect, center)
        if (Math.hypot(nearest.x - center.x, nearest.z - center.z) < feature.radiusM) {
          out.push(nearest)
        }
        break
      }
      case 'ramp':
        rampPeaks(feature, rect, out)
        break
      case 'pit':
        // Depressão só desce: não tem pico.
        break
    }
  }
  return out
}

/** Quanto (m) o ponto mais fundo da caixa está abaixo do terreno (0 se nenhum ponto passa da tolerância). */
export function obbTerrainDepth(obb: Obb, terrain: TerrainSpec): number {
  const bottom = obbBottomFace(obb)
  let depth = 0
  const check = (x: number, y: number, z: number): void => {
    const below = terrainHeightAt(terrain, x, z) - y
    if (below > TERRAIN_TOLERANCE_M && below > depth) depth = below
  }
  if (!bottom) {
    for (const point of obbSurfacePoints(obb, TERRAIN_SAMPLE_STEP_M))
      check(point.x, point.y, point.z)
    return depth
  }
  for (const point of groundGrid(bottom.rect)) check(point.x, bottom.bottomY, point.z)
  for (const point of terrainPeaks(terrain, bottom.rect)) check(point.x, bottom.bottomY, point.z)
  return depth
}
