// Cliente REST de `/api/v1/scenarios` (TASK-052; ADR-023). O JSON do backend é `snake_case`
// (`ScenarioSpec` equivalente ao de `src/domain/environment/environment.ts`); aqui vira o domínio em
// `camelCase`, e o caminho inverso na gravação.
//
// - `GET    /scenarios` → 200 `{items}` (resumo, sem `spec`); qualquer usuário logado;
// - `GET    /scenarios/{id}` → 200 com `spec`; 404 `SCENARIO_NOT_FOUND`;
// - `POST   /scenarios` `{name, spec}` → 201; 422;
// - `PUT    /scenarios/{id}` `{name?, spec?}` → 200; 403 `FORBIDDEN` (não é o autor nem admin); 404; 422;
// - `DELETE /scenarios/{id}` → 204; 403; 404.

import {
  type CargoPlacement,
  type CranePlacement,
  type ExtraCrane,
  type Obstacle,
  type ScenarioSpec,
  SOIL_KINDS,
  type SoilZone,
  type TerrainFeature,
  type WindSpec,
} from '../../domain/environment/environment'
import type {
  SavedScenario,
  ScenarioGateway,
  ScenarioSummary,
} from '../../application/environment/ports'
import {
  ContractViolationError,
  type JsonRecord,
  readArray,
  readNullableNumber,
  readNumber,
  readRecord,
  readString,
} from '../shared/readJson'
import { type AuthHttpOptions, createSendJson, guardContract } from './authHttp'

export const SCENARIOS_PATH = '/api/v1/scenarios'

const FEATURE_KINDS: readonly TerrainFeature['kind'][] = [
  'mound',
  'pit',
  'plateau',
  'ramp',
  'flatten',
]
const OBSTACLE_KINDS: readonly Obstacle['kind'][] = ['box', 'cylinder']

/** `ScenarioSpec` no JSON do backend. */
export function toScenarioSpecDto(spec: ScenarioSpec): Record<string, unknown> {
  return {
    terrain: {
      slope_x_percent: spec.terrain.slopeXPercent,
      slope_z_percent: spec.terrain.slopeZPercent,
      features: spec.terrain.features.map((feature) => ({
        id: feature.id,
        kind: feature.kind,
        center_x: feature.centerX,
        center_z: feature.centerZ,
        radius_m: feature.radiusM,
        height_m: feature.heightM,
        ...(feature.directionDeg === undefined ? {} : { direction_deg: feature.directionDeg }),
        ...(feature.widthM === undefined ? {} : { width_m: feature.widthM }),
      })),
    },
    obstacles: spec.obstacles.map((obstacle) => ({
      id: obstacle.id,
      label: obstacle.label,
      kind: obstacle.kind,
      center_x: obstacle.centerX,
      center_z: obstacle.centerZ,
      width_m: obstacle.widthM,
      depth_m: obstacle.depthM,
      height_m: obstacle.heightM,
      rotation_y_deg: obstacle.rotationYDeg,
    })),
    crane: { x: spec.crane.x, z: spec.crane.z, heading_deg: spec.crane.headingDeg },
    ...(spec.soilZones && spec.soilZones.length > 0
      ? {
          soil_zones: spec.soilZones.map((zone) => ({
            id: zone.id,
            kind: zone.kind,
            center_x: zone.centerX,
            center_z: zone.centerZ,
            radius_m: zone.radiusM,
          })),
        }
      : {}),
    ...(spec.wind
      ? { wind: { speed_ms: spec.wind.speedMs, direction_deg: spec.wind.directionDeg } }
      : {}),
    ...(spec.cranes && spec.cranes.length > 0
      ? {
          cranes: spec.cranes.map((extra) => ({
            id: extra.id,
            configuration_id: extra.configurationId,
            placement: {
              x: extra.placement.x,
              z: extra.placement.z,
              heading_deg: extra.placement.headingDeg,
            },
          })),
        }
      : {}),
    ...(spec.cargo
      ? {
          cargo: {
            x: spec.cargo.x,
            z: spec.cargo.z,
            rotation_y_deg: spec.cargo.rotationYDeg,
          },
        }
      : {}),
  }
}

function readOneOf<T extends string>(
  record: JsonRecord,
  key: string,
  path: string,
  allowed: readonly T[],
): T {
  const value = readString(record, key, path)
  const found = allowed.find((item) => item === value)
  if (found === undefined) {
    throw new ContractViolationError(`${path}.${key}`, allowed.map((a) => `"${a}"`).join(' ou '))
  }
  return found
}

function mapFeature(json: unknown, path: string): TerrainFeature {
  const record = readRecord(json, path)
  const directionDeg = readNullableNumber(record, 'direction_deg', path)
  const widthM = readNullableNumber(record, 'width_m', path)
  return {
    id: readString(record, 'id', path),
    kind: readOneOf(record, 'kind', path, FEATURE_KINDS),
    centerX: readNumber(record, 'center_x', path),
    centerZ: readNumber(record, 'center_z', path),
    radiusM: readNumber(record, 'radius_m', path),
    heightM: readNumber(record, 'height_m', path),
    ...(directionDeg === null ? {} : { directionDeg }),
    ...(widthM === null ? {} : { widthM }),
  }
}

function mapObstacle(json: unknown, path: string): Obstacle {
  const record = readRecord(json, path)
  return {
    id: readString(record, 'id', path),
    label: readString(record, 'label', path),
    kind: readOneOf(record, 'kind', path, OBSTACLE_KINDS),
    centerX: readNumber(record, 'center_x', path),
    centerZ: readNumber(record, 'center_z', path),
    widthM: readNumber(record, 'width_m', path),
    depthM: readNumber(record, 'depth_m', path),
    heightM: readNumber(record, 'height_m', path),
    rotationYDeg: readNumber(record, 'rotation_y_deg', path),
  }
}

function mapSoilZone(json: unknown, path: string): SoilZone {
  const record = readRecord(json, path)
  return {
    id: readString(record, 'id', path),
    kind: readOneOf(record, 'kind', path, SOIL_KINDS),
    centerX: readNumber(record, 'center_x', path),
    centerZ: readNumber(record, 'center_z', path),
    radiusM: readNumber(record, 'radius_m', path),
  }
}

function mapWind(json: unknown, path: string): WindSpec {
  const record = readRecord(json, path)
  return {
    speedMs: readNumber(record, 'speed_ms', path),
    directionDeg: readNumber(record, 'direction_deg', path),
  }
}

export function mapScenarioSpec(json: unknown, path: string): ScenarioSpec {
  const record = readRecord(json, path)
  const terrain = readRecord(record.terrain, `${path}.terrain`)
  const crane = readRecord(record.crane, `${path}.crane`)
  const placement: CranePlacement = {
    x: readNumber(crane, 'x', `${path}.crane`),
    z: readNumber(crane, 'z', `${path}.crane`),
    headingDeg: readNumber(crane, 'heading_deg', `${path}.crane`),
  }
  return {
    terrain: {
      slopeXPercent: readNumber(terrain, 'slope_x_percent', `${path}.terrain`),
      slopeZPercent: readNumber(terrain, 'slope_z_percent', `${path}.terrain`),
      features: readArray(terrain, 'features', `${path}.terrain`).map((item, index) =>
        mapFeature(item, `${path}.terrain.features[${index}]`),
      ),
    },
    obstacles: readArray(record, 'obstacles', path).map((item, index) =>
      mapObstacle(item, `${path}.obstacles[${index}]`),
    ),
    crane: placement,
    // Campos da TASK-066: cenários salvos antes deles não os têm (ausente ou `null`).
    ...(Array.isArray(record.soil_zones) && record.soil_zones.length > 0
      ? {
          soilZones: record.soil_zones.map((item, index) =>
            mapSoilZone(item, `${path}.soil_zones[${index}]`),
          ),
        }
      : {}),
    ...(record.wind != null ? { wind: mapWind(record.wind, `${path}.wind`) } : {}),
    // Campos da TASK-074 (e a carga, da TASK-073): ausentes nos cenários salvos antes deles.
    ...(Array.isArray(record.cranes) && record.cranes.length > 0
      ? {
          cranes: record.cranes.map((item, index) =>
            mapExtraCrane(item, `${path}.cranes[${index}]`),
          ),
        }
      : {}),
    ...(record.cargo != null ? { cargo: mapCargo(record.cargo, `${path}.cargo`) } : {}),
  }
}

function mapExtraCrane(json: unknown, path: string): ExtraCrane {
  const record = readRecord(json, path)
  const placement = readRecord(record.placement, `${path}.placement`)
  return {
    id: readString(record, 'id', path),
    configurationId: readString(record, 'configuration_id', path),
    placement: {
      x: readNumber(placement, 'x', `${path}.placement`),
      z: readNumber(placement, 'z', `${path}.placement`),
      headingDeg: readNumber(placement, 'heading_deg', `${path}.placement`),
    },
  }
}

function mapCargo(json: unknown, path: string): CargoPlacement {
  const record = readRecord(json, path)
  return {
    x: readNumber(record, 'x', path),
    z: readNumber(record, 'z', path),
    rotationYDeg: readNumber(record, 'rotation_y_deg', path),
  }
}

function mapSummary(json: unknown, path: string): ScenarioSummary {
  const record = readRecord(json, path)
  return {
    id: readString(record, 'id', path),
    name: readString(record, 'name', path),
    authorUserId: readString(record, 'author_user_id', path),
    createdAt: readString(record, 'created_at', path),
    updatedAt: readString(record, 'updated_at', path),
  }
}

function mapScenario(json: unknown, path: string): SavedScenario {
  const record = readRecord(json, path)
  return { ...mapSummary(json, path), spec: mapScenarioSpec(record.spec, `${path}.spec`) }
}

export function createScenarioRestClient(options: AuthHttpOptions = {}): ScenarioGateway {
  const send = createSendJson(options)
  const itemPath = (id: string) => `${SCENARIOS_PATH}/${encodeURIComponent(id)}`

  return {
    async list() {
      const { json } = await send('GET', SCENARIOS_PATH)
      return guardContract(() =>
        readArray(readRecord(json, 'response'), 'items', 'response').map((item, index) =>
          mapSummary(item, `response.items[${index}]`),
        ),
      )
    },

    async get(id) {
      const { json } = await send('GET', itemPath(id))
      return guardContract(() => mapScenario(json, 'response'))
    },

    async create(name, spec) {
      const { json } = await send('POST', SCENARIOS_PATH, { name, spec: toScenarioSpecDto(spec) })
      return guardContract(() => mapScenario(json, 'response'))
    },

    async update(id, changes) {
      const body: Record<string, unknown> = {}
      if (changes.name !== undefined) body.name = changes.name
      if (changes.spec !== undefined) body.spec = toScenarioSpecDto(changes.spec)
      const { json } = await send('PUT', itemPath(id), body)
      return guardContract(() => mapScenario(json, 'response'))
    },

    async remove(id) {
      await send('DELETE', itemPath(id))
    },
  }
}
