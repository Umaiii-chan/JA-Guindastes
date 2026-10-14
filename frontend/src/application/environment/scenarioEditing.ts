// Edição do cenário (TASK-052; ADR-023): funções puras sobre o `ScenarioSpec` do domínio, usadas pelo
// painel "Ambiente". Não validam o que o backend valida de novo (faixas e limites de quantidade): só
// impedem valores que não têm desenho (número não finito, raio zero, dimensão <= 0).

import {
  type CranePlacement,
  type Obstacle,
  type ScenarioSpec,
  type SoilKind,
  type TerrainFeature,
  type TerrainSpec,
  terrainSlopeUnderFootprintDeg,
} from '../../domain/environment/environment'
import { isFlatTerrain } from '../../domain/environment/flatTerrain'

export { isFlatTerrain }

/**
 * Sapatas FICTÍCIAS (ADR-012) sob as quais se mede a inclinação do terreno: retângulo de meia
 * distância 3 m ao longo do chassi e 2,5 m na transversal. Valem até a TASK-054 (patolas) trazer as
 * posições reais das sapatas do modelo.
 */
export const FICTITIOUS_FOOTPRINT_HALF_LENGTH_M = 3
export const FICTITIOUS_FOOTPRINT_HALF_WIDTH_M = 2.5

/** Limites de quantidade do backend (`app.domain.entities.scenario`). */
export const MAX_TERRAIN_FEATURES = 50
export const MAX_OBSTACLES = 100
/** Limite da inclinação do plano, em % (backend). */
export const SLOPE_PERCENT_LIMIT = 100

export const FEATURE_KIND_LABELS: Readonly<Record<TerrainFeature['kind'], string>> = {
  mound: 'Elevação',
  pit: 'Depressão',
  plateau: 'Platô',
  ramp: 'Rampa',
  flatten: 'Nivelamento',
}

export const SOIL_KIND_LABELS: Readonly<Record<SoilKind, string>> = {
  rock: 'Rochoso',
  compacted: 'Compactado',
  clay: 'Argiloso',
  loose_fill: 'Aterro solto',
}

export const OBSTACLE_KIND_LABELS: Readonly<Record<Obstacle['kind'], string>> = {
  box: 'Caixa',
  cylinder: 'Cilindro',
  model: 'Objeto',
}

/** Obstáculos criados por forma (caixa e cilindro); os objetos da biblioteca entram por `addModelAt`. */
export type PrimitiveObstacleKind = Exclude<Obstacle['kind'], 'model'>

/**
 * O rumo do cenário (`CranePlacement.headingDeg`) gira a cena como `rotation.y` (anti-horário visto
 * de cima; 0 = chassi como modelado, com a frente em +Z, ADR-013 C-1). `terrainSlopeUnderFootprintDeg`
 * mede "ao longo" na direção `(cos h, -sin h)`; para esse eixo coincidir com a frente do chassi,
 * `h = rumo - 90°` (registrado no ADR-023).
 */
export function footprintPlacement(placement: CranePlacement): CranePlacement {
  return { ...placement, headingDeg: placement.headingDeg - 90 }
}

/** Inclinação do terreno sob as sapatas FICTÍCIAS do guindaste, em graus (>= 0). */
export function groundSlopeUnderCraneDeg(spec: ScenarioSpec): number {
  return terrainSlopeUnderFootprintDeg(
    spec.terrain,
    footprintPlacement(spec.crane),
    FICTITIOUS_FOOTPRINT_HALF_LENGTH_M,
    FICTITIOUS_FOOTPRINT_HALF_WIDTH_M,
  )
}

/**
 * `ground_slope_deg` enviado à avaliação: `undefined` com terreno plano (a requisição fica como era);
 * senão a inclinação sob as sapatas, arredondada a 0,01° para o valor não mudar a cada ruído.
 */
export function scenarioGroundSlopeDeg(spec: ScenarioSpec): number | undefined {
  if (isFlatTerrain(spec.terrain)) return undefined
  return Math.round(groundSlopeUnderCraneDeg(spec) * 100) / 100
}

function nextId(prefix: string, taken: readonly string[]): string {
  let n = taken.length + 1
  while (taken.includes(`${prefix}-${n}`)) n += 1
  return `${prefix}-${n}`
}

export function newFeature(
  kind: TerrainFeature['kind'],
  existing: readonly TerrainFeature[],
): TerrainFeature {
  const base: TerrainFeature = {
    id: nextId(
      kind,
      existing.map((feature) => feature.id),
    ),
    kind,
    centerX: 10,
    centerZ: 0,
    radiusM: 5,
    heightM: 1,
  }
  if (kind === 'ramp') return { ...base, radiusM: 6, heightM: 1.5, directionDeg: 0, widthM: 4 }
  return base
}

export function newObstacle(kind: PrimitiveObstacleKind, existing: readonly Obstacle[]): Obstacle {
  const id = nextId(
    kind,
    existing.map((obstacle) => obstacle.id),
  )
  const n = existing.length + 1
  return kind === 'box'
    ? {
        id,
        label: `Caixa ${n}`,
        kind,
        centerX: 12,
        centerZ: 6,
        widthM: 3,
        depthM: 2,
        heightM: 2,
        rotationYDeg: 0,
      }
    : {
        id,
        label: `Cilindro ${n}`,
        kind,
        centerX: 12,
        centerZ: -6,
        widthM: 2,
        depthM: 2,
        heightM: 4,
        rotationYDeg: 0,
      }
}

export function withTerrain(spec: ScenarioSpec, terrain: TerrainSpec): ScenarioSpec {
  return { ...spec, terrain }
}

export function addFeature(spec: ScenarioSpec, kind: TerrainFeature['kind']): ScenarioSpec {
  if (spec.terrain.features.length >= MAX_TERRAIN_FEATURES) return spec
  const feature = newFeature(kind, spec.terrain.features)
  return withTerrain(spec, { ...spec.terrain, features: [...spec.terrain.features, feature] })
}

export function updateFeature(
  spec: ScenarioSpec,
  id: string,
  changes: Partial<Omit<TerrainFeature, 'id' | 'kind'>>,
): ScenarioSpec {
  const features = spec.terrain.features.map((feature) =>
    feature.id === id ? { ...feature, ...changes } : feature,
  )
  return withTerrain(spec, { ...spec.terrain, features })
}

export function removeFeature(spec: ScenarioSpec, id: string): ScenarioSpec {
  const features = spec.terrain.features.filter((feature) => feature.id !== id)
  return withTerrain(spec, { ...spec.terrain, features })
}

export function addObstacle(spec: ScenarioSpec, kind: PrimitiveObstacleKind): ScenarioSpec {
  if (spec.obstacles.length >= MAX_OBSTACLES) return spec
  return { ...spec, obstacles: [...spec.obstacles, newObstacle(kind, spec.obstacles)] }
}

export function updateObstacle(
  spec: ScenarioSpec,
  id: string,
  changes: Partial<Omit<Obstacle, 'id' | 'kind' | 'modelId'>>,
): ScenarioSpec {
  return {
    ...spec,
    obstacles: spec.obstacles.map((obstacle) =>
      obstacle.id === id ? { ...obstacle, ...changes } : obstacle,
    ),
  }
}

export function removeObstacle(spec: ScenarioSpec, id: string): ScenarioSpec {
  return { ...spec, obstacles: spec.obstacles.filter((obstacle) => obstacle.id !== id) }
}

export function withSlope(
  spec: ScenarioSpec,
  axis: 'slopeXPercent' | 'slopeZPercent',
  value: number,
): ScenarioSpec {
  return withTerrain(spec, { ...spec.terrain, [axis]: value })
}

export function withCranePlacement(
  spec: ScenarioSpec,
  changes: Partial<CranePlacement>,
): ScenarioSpec {
  return { ...spec, crane: { ...spec.crane, ...changes } }
}

/** Resumo de uma linha do cenário, para o cabeçalho do painel recolhido. */
export function environmentSummary(spec: ScenarioSpec): string {
  const features = spec.terrain.features.length
  const sloped = spec.terrain.slopeXPercent !== 0 || spec.terrain.slopeZPercent !== 0
  if (
    !sloped &&
    features === 0 &&
    spec.obstacles.length === 0 &&
    !spec.soilZones?.length &&
    !(spec.wind && spec.wind.speedMs > 0) &&
    !spec.cargo &&
    !spec.delivery
  )
    return 'Terreno plano, sem obstáculos'
  const soil = spec.soilZones?.length ?? 0
  const parts = [
    sloped ? 'terreno inclinado' : null,
    features > 0 ? `${features} ${features === 1 ? 'feição' : 'feições'}` : null,
    spec.obstacles.length > 0
      ? `${spec.obstacles.length} ${spec.obstacles.length === 1 ? 'obstáculo' : 'obstáculos'}`
      : null,
    soil > 0 ? `${soil} ${soil === 1 ? 'área de solo' : 'áreas de solo'}` : null,
    spec.wind && spec.wind.speedMs > 0
      ? `vento ${spec.wind.speedMs.toLocaleString('pt-BR')} m/s`
      : null,
    spec.cargo ? 'carga posicionada' : null,
    spec.delivery ? 'ponto de entrega' : null,
  ]
  return parts.filter(Boolean).join(' · ')
}
