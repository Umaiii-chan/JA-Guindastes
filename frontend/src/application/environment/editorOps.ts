// Operações do editor 3D do ambiente (TASK-066; ADR-032): funções puras sobre o `ScenarioSpec`.
// Cada pincelada vira feições do `TerrainSpec` existente (`mound`, `pit`, `flatten`), sem criar um
// formato novo de terreno; o solo pintado vira `soilZones`. Os limites de quantidade são os do backend.

import {
  type Obstacle,
  type ScenarioSpec,
  type SoilKind,
  type SoilZone,
  soilAt,
  type TerrainFeature,
  terrainHeightAt,
  type WindSpec,
} from '../../domain/environment/environment'
import { shoePoints } from '../../domain/environment/craneAttitude'
import { findLibraryObject, newModelObstacle } from '../../domain/environment/objectLibrary'
import {
  MAX_OBSTACLES,
  MAX_TERRAIN_FEATURES,
  newObstacle,
  type PrimitiveObstacleKind,
} from './scenarioEditing'

/** Limite de zonas de solo (backend). */
export const MAX_SOIL_ZONES = 200

/** Pincel: raio (m) e intensidade (m de altura por pincelada). */
export interface Brush {
  readonly radiusM: number
  readonly intensityM: number
}

export const DEFAULT_BRUSH: Brush = { radiusM: 4, intensityM: 0.4 }
export const BRUSH_RADIUS_RANGE = { min: 1, max: 15 } as const
export const BRUSH_INTENSITY_RANGE = { min: 0.1, max: 2 } as const

/** Pinceladas muito próximas (menos que isto do raio) somam na mesma feição, para não lotar a lista. */
const MERGE_FRACTION = 0.3
const MIN_VISIBLE_HEIGHT_M = 0.005

function takenIds(spec: ScenarioSpec): readonly string[] {
  return spec.terrain.features.map((feature) => feature.id)
}

function freshId(prefix: string, taken: readonly string[]): string {
  let n = taken.length + 1
  while (taken.includes(`${prefix}-${n}`)) n += 1
  return `${prefix}-${n}`
}

function withFeatures(spec: ScenarioSpec, features: readonly TerrainFeature[]): ScenarioSpec {
  return { ...spec, terrain: { ...spec.terrain, features } }
}

/**
 * Sobe (`deltaM > 0`) ou desce (`deltaM < 0`) o terreno em (x, z). Soma na elevação ou depressão que
 * já estiver ali, com o mesmo raio; senão cria uma feição nova. Sem espaço (50 feições), não muda.
 */
export function sculptAt(
  spec: ScenarioSpec,
  x: number,
  z: number,
  radiusM: number,
  deltaM: number,
): ScenarioSpec {
  if (!(radiusM > 0) || deltaM === 0) return spec
  const features = spec.terrain.features
  const index = features.findIndex(
    (feature) =>
      (feature.kind === 'mound' || feature.kind === 'pit') &&
      feature.radiusM === radiusM &&
      Math.hypot(feature.centerX - x, feature.centerZ - z) <= radiusM * MERGE_FRACTION,
  )
  if (index >= 0) {
    const current = features[index] as TerrainFeature
    const signed = (current.kind === 'mound' ? 1 : -1) * current.heightM + deltaM
    if (Math.abs(signed) < MIN_VISIBLE_HEIGHT_M) {
      return withFeatures(
        spec,
        features.filter((_, i) => i !== index),
      )
    }
    const updated: TerrainFeature = {
      ...current,
      kind: signed >= 0 ? 'mound' : 'pit',
      heightM: Math.round(Math.abs(signed) * 1000) / 1000,
    }
    return withFeatures(
      spec,
      features.map((feature, i) => (i === index ? updated : feature)),
    )
  }
  if (features.length >= MAX_TERRAIN_FEATURES) return spec
  const kind = deltaM > 0 ? 'mound' : 'pit'
  const feature: TerrainFeature = {
    id: freshId(kind, takenIds(spec)),
    kind,
    centerX: Math.round(x * 100) / 100,
    centerZ: Math.round(z * 100) / 100,
    radiusM,
    heightM: Math.round(Math.abs(deltaM) * 1000) / 1000,
  }
  return withFeatures(spec, [...features, feature])
}

/** Nivela o terreno ao redor de (x, z) até `levelM` (altura absoluta). */
export function flattenAt(
  spec: ScenarioSpec,
  x: number,
  z: number,
  radiusM: number,
  levelM: number,
): ScenarioSpec {
  if (!(radiusM > 0) || !Number.isFinite(levelM)) return spec
  const features = spec.terrain.features
  const index = features.findIndex(
    (feature) =>
      feature.kind === 'flatten' &&
      feature.radiusM === radiusM &&
      Math.hypot(feature.centerX - x, feature.centerZ - z) <= radiusM * MERGE_FRACTION &&
      feature.heightM === levelM,
  )
  // Mesmo lugar e mesmo nível: nada a fazer. Uma pincelada nova vai sempre ao fim da lista, para
  // valer sobre o que já foi esculpido.
  if (index >= 0 && index === features.length - 1) return spec
  const rest = index >= 0 ? features.filter((_, i) => i !== index) : features
  if (index < 0 && features.length >= MAX_TERRAIN_FEATURES) return spec
  const feature: TerrainFeature = {
    id: index >= 0 ? (features[index] as TerrainFeature).id : freshId('flatten', takenIds(spec)),
    kind: 'flatten',
    centerX: Math.round(x * 100) / 100,
    centerZ: Math.round(z * 100) / 100,
    radiusM,
    heightM: Math.round(levelM * 1000) / 1000,
  }
  return withFeatures(spec, [...rest, feature])
}

/** Pinta um círculo de solo em (x, z). Repintar no mesmo lugar com o mesmo tipo não faz nada. */
export function paintSoil(
  spec: ScenarioSpec,
  kind: SoilKind,
  x: number,
  z: number,
  radiusM: number,
): ScenarioSpec {
  if (!(radiusM > 0)) return spec
  const zones = spec.soilZones ?? []
  const last = zones[zones.length - 1]
  if (
    last &&
    last.kind === kind &&
    last.radiusM === radiusM &&
    Math.hypot(last.centerX - x, last.centerZ - z) <= radiusM * MERGE_FRACTION
  ) {
    return spec
  }
  if (zones.length >= MAX_SOIL_ZONES) return spec
  const taken = zones.map((zone) => zone.id)
  const zone: SoilZone = {
    id: freshId('soil', taken),
    kind,
    centerX: Math.round(x * 100) / 100,
    centerZ: Math.round(z * 100) / 100,
    radiusM,
  }
  return { ...spec, soilZones: [...zones, zone] }
}

/** Novo obstáculo no ponto (x, z) do chão; a base assenta no terreno (a cena faz isso ao desenhar). */
export function addObstacleAt(
  spec: ScenarioSpec,
  kind: PrimitiveObstacleKind,
  x: number,
  z: number,
): { readonly spec: ScenarioSpec; readonly id: string | null } {
  if (spec.obstacles.length >= MAX_OBSTACLES) return { spec, id: null }
  const base = newObstacle(kind, spec.obstacles)
  const obstacle: Obstacle = {
    ...base,
    centerX: Math.round(x * 100) / 100,
    centerZ: Math.round(z * 100) / 100,
  }
  return { spec: { ...spec, obstacles: [...spec.obstacles, obstacle] }, id: obstacle.id }
}

/**
 * Novo objeto da biblioteca (TASK-072) no ponto (x, z) do chão, em tamanho real e sem giro; a base
 * assenta no terreno (a cena faz isso ao desenhar). Id desconhecido ou sem espaço (100 obstáculos):
 * não muda nada. O id é `<objeto>-<n>` e o nome repete o do objeto, com o número a partir do segundo.
 */
export function addModelAt(
  spec: ScenarioSpec,
  modelId: string,
  x: number,
  z: number,
): { readonly spec: ScenarioSpec; readonly id: string | null } {
  const object = findLibraryObject(modelId)
  if (!object || spec.obstacles.length >= MAX_OBSTACLES) return { spec, id: null }
  const takenIds = spec.obstacles.map((obstacle) => obstacle.id)
  let n = 1
  while (takenIds.includes(`${object.id}-${n}`)) n += 1
  const sameModel = spec.obstacles.filter((obstacle) => obstacle.modelId === object.id).length
  const label = sameModel === 0 ? object.label : `${object.label} ${sameModel + 1}`
  const obstacle: Obstacle = {
    ...newModelObstacle(object, `${object.id}-${n}`, label),
    centerX: Math.round(x * 100) / 100,
    centerZ: Math.round(z * 100) / 100,
  }
  return { spec: { ...spec, obstacles: [...spec.obstacles, obstacle] }, id: obstacle.id }
}

/** Troca vento (velocidade >= 0); velocidade 0 remove o vento do cenário. */
export function withWind(spec: ScenarioSpec, wind: WindSpec): ScenarioSpec {
  const speedMs = Number.isFinite(wind.speedMs) ? Math.max(0, wind.speedMs) : 0
  const directionDeg = Number.isFinite(wind.directionDeg) ? wind.directionDeg : 0
  if (speedMs === 0) {
    const { wind: _removed, ...rest } = spec
    void _removed
    return directionDeg === 0 ? rest : { ...rest, wind: { speedMs: 0, directionDeg } }
  }
  return { ...spec, wind: { speedMs, directionDeg } }
}

/**
 * Solo sob cada uma das quatro sapatas, na ordem fl, fr, rl, rr; `undefined` sem zonas pintadas (a
 * requisição fica como era: tudo compactado).
 */
export function soilKindsUnderShoes(spec: ScenarioSpec): readonly SoilKind[] | undefined {
  if (!spec.soilZones || spec.soilZones.length === 0) return undefined
  return shoePoints(spec.terrain, spec.crane).map((shoe) => soilAt(spec, shoe.x, shoe.z))
}

/** Velocidade do vento enviada à avaliação; `undefined` sem vento. */
export function windSpeedForEvaluation(spec: ScenarioSpec): number | undefined {
  const speed = spec.wind?.speedMs
  return speed !== undefined && speed > 0 ? speed : undefined
}

/** Altura do terreno no centro do pincel, usada como nível do "Aplainar". */
export function levelAt(spec: ScenarioSpec, x: number, z: number): number {
  return terrainHeightAt(spec.terrain, x, z)
}
