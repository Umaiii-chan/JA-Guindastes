// Coleta e entrega da carga (TASK-073; ADR-035), sem Three.js: onde a carga está (no chão ou no
// gancho), quando dá para engatar e soltar e se a entrega caiu dentro do alvo. São regras de
// pré-visualização e de interface na cena: capacidade e segurança continuam sendo do backend (RN-008).
//
// Eixos da cena (ADR-013): Y para cima; X e Z no chão; metros e graus (RN-006).

import { type HookedCargoPose, type LoadDimensions } from '../collision/loadBox'
import { mulVec, rotY, type Transform, type Vec3 } from '../collision/obb'
import {
  type CargoPlacement,
  type DeliveryPoint,
  type Obstacle,
  type TerrainSpec,
  terrainHeightAt,
} from '../environment/environment'
import { type LoadBed, loadBedsOf, loadBedTopUnder, loadBedUnder } from './loadBeds'

const DEG = Math.PI / 180

/** Engate: o gancho (ou o fim da cadeia de acessórios) até 0,5 m acima do topo da carga. */
export const ENGAGE_MAX_GAP_M = 0.5
/** Folga abaixo do topo (m) que ainda conta como encostado: ruído da caixa do gancho. */
export const ENGAGE_MIN_GAP_M = -0.1
/** Engate: alinhamento horizontal entre o gancho e o centro da carga. */
export const ENGAGE_HORIZONTAL_TOLERANCE_M = 0.5
/** Solta: a base da carga até 0,2 m da superfície de apoio (o chão ou a carroceria de um caminhão). */
export const RELEASE_MAX_HEIGHT_M = 0.2
/** Menor altura das lingas desenhadas ao engatar (m). */
export const MIN_SLING_DROP_M = 0.05

export type CargoPhase = 'ground' | 'hooked'

/** Resultado da última soltura: dentro do alvo, fora dele, ou nada ainda. */
export type DeliveryResult = 'none' | 'delivered' | 'outside'

/** Onde a carga está e o que já aconteceu com ela; é o que a gravação guarda em cada quadro. */
export interface CargoState {
  readonly phase: CargoPhase
  /** Posição no chão (válida com `phase: 'ground'`; guarda onde ficou na última soltura). */
  readonly x: number
  readonly z: number
  readonly rotationYDeg: number
  /** Posição em relação ao gancho, só com `phase: 'hooked'`. */
  readonly hooked?: HookedCargoPose
  readonly result: DeliveryResult
  /** Tempo da operação (ms) quando a entrega foi feita: do primeiro engate à soltura no alvo. */
  readonly elapsedMs?: number
}

/** Situação da operação para a interface. */
/** O apoio (caminhão, carreta ou contêiner) sob a carga, para a interface dizer o que se sabe dele (ADR-052). */
export interface BedStatus {
  /** Nome do objeto da biblioteca ("Contêiner 40' (ISO)"). */
  readonly label: string
  /** Capacidade conhecida (kg); `null` = sem dado (FICTÍCIO). */
  readonly capacityKg: number | null
  /** De onde vem a capacidade, ou o rótulo FICTÍCIO. */
  readonly source: string
}

export interface CargoStatus {
  /** Há carga posicionada e com medidas válidas: vale o modo de coleta e entrega. */
  readonly active: boolean
  readonly hasDelivery: boolean
  readonly state: CargoState | null
  readonly canEngage: boolean
  readonly canRelease: boolean
  /** Com a carga no chão: quanto o fim do gancho está acima do topo dela (m). */
  readonly gapM: number | null
  /** Com a carga no chão: distância horizontal do gancho ao centro dela (m). */
  readonly offsetM: number | null
  /** Com a carga no gancho: altura da base dela acima do chão (m). */
  readonly heightAboveGroundM: number | null
  /** Com a carga no gancho e um ponto de entrega: distância horizontal até o centro do alvo (m). */
  readonly distanceToDeliveryM: number | null
  /** O apoio sobre o objeto sob a carga (no chão: onde ela está; no gancho: onde soltaria); `null` = o terreno. */
  readonly bed?: BedStatus | null
}

/** O apoio sob o ponto (centro da pegada), ou `null` se é o terreno. */
export function bedStatusAt(
  point: { readonly x: number; readonly z: number },
  terrain: TerrainSpec,
  obstacles: readonly Obstacle[],
): BedStatus | null {
  const bed: LoadBed | null = loadBedUnder(point, loadBedsOf(obstacles, terrain))
  return bed
    ? { label: bed.objectLabel, capacityKg: bed.capacityKg ?? null, source: bed.capacitySource }
    : null
}

export const INACTIVE_CARGO: CargoStatus = {
  active: false,
  hasDelivery: false,
  state: null,
  canEngage: false,
  canRelease: false,
  gapM: null,
  offsetM: null,
  heightAboveGroundM: null,
  distanceToDeliveryM: null,
}

/** Chave estável da situação, com as distâncias em décimos de metro, para avisar a UI só se mudou. */
export function cargoStatusKey(status: CargoStatus): string {
  const tenth = (value: number | null) => (value === null ? null : Math.round(value * 10))
  return JSON.stringify([
    status.active,
    status.hasDelivery,
    status.state,
    status.canEngage,
    status.canRelease,
    tenth(status.gapM),
    tenth(status.offsetM),
    tenth(status.heightAboveGroundM),
    tenth(status.distanceToDeliveryM),
    status.bed ? [status.bed.label, status.bed.capacityKg] : null,
  ])
}

/** Estado inicial: a carga no chão, na posição escolhida. */
export function initialCargoState(placement: CargoPlacement): CargoState {
  return {
    phase: 'ground',
    x: placement.x,
    z: placement.z,
    rotationYDeg: placement.rotationYDeg,
    result: 'none',
  }
}

/** Mesma posição inicial? */
export function samePlacement(
  a: CargoPlacement | null | undefined,
  b: CargoPlacement | null | undefined,
): boolean {
  if (!a || !b) return !a === !b
  return a.x === b.x && a.z === b.z && a.rotationYDeg === b.rotationYDeg
}

export interface GroundPose {
  readonly x: number
  readonly z: number
  readonly rotationYDeg: number
}

/** Os quatro cantos da base no chão (x, z), na ordem do `corner` da caixa engatada. */
export function footprintCorners(
  size: LoadDimensions,
  pose: GroundPose,
): readonly { readonly x: number; readonly z: number }[] {
  const yaw = pose.rotationYDeg * DEG
  const cos = Math.cos(yaw)
  const sin = Math.sin(yaw)
  const halfX = size.widthM / 2
  const halfZ = size.lengthM / 2
  return [
    [-halfX, -halfZ],
    [halfX, -halfZ],
    [halfX, halfZ],
    [-halfX, halfZ],
  ].map(([x, z]) => ({
    x: pose.x + (x as number) * cos + (z as number) * sin,
    z: pose.z - (x as number) * sin + (z as number) * cos,
  }))
}

/** Onde a base da carga assenta: a altura (m) e se é no topo de uma carroceria (e não no terreno). */
export interface CargoSupport {
  readonly baseY: number
  readonly onBed: boolean
}

/**
 * Apoio da carga no chão: o maior entre o ponto mais alto do terreno sob a pegada (centro, cantos e
 * meios das arestas), para a caixa não entrar no chão em terreno irregular, e o topo da carroceria de
 * um caminhão plataforma (TASK-101; ADR-046) **só se o centro da pegada cair dentro da carroceria**
 * (TASK-103): apoiada na borda ou com só a ponta sobre ela, a carga assenta no terreno e o caminhão
 * é um obstáculo comum.
 */
export function cargoSupport(
  terrain: TerrainSpec,
  size: LoadDimensions,
  pose: GroundPose,
  obstacles: readonly Obstacle[] = [],
): CargoSupport {
  const corners = footprintCorners(size, pose)
  const points = [{ x: pose.x, z: pose.z }, ...corners]
  for (let index = 0; index < corners.length; index += 1) {
    const a = corners[index] as { x: number; z: number }
    const b = corners[(index + 1) % corners.length] as { x: number; z: number }
    points.push({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 })
  }
  const terrainY = Math.max(...points.map((point) => terrainHeightAt(terrain, point.x, point.z)))
  const bedY = loadBedTopUnder({ x: pose.x, z: pose.z }, loadBedsOf(obstacles, terrain))
  return bedY !== null && bedY >= terrainY
    ? { baseY: bedY, onBed: true }
    : { baseY: terrainY, onBed: false }
}

/** Altura (m) em que a base da carga assenta (`cargoSupport`). */
export function cargoBaseY(
  terrain: TerrainSpec,
  size: LoadDimensions,
  pose: GroundPose,
  obstacles: readonly Obstacle[] = [],
): number {
  return cargoSupport(terrain, size, pose, obstacles).baseY
}

/** O gancho no mundo: referencial (origem em G, eixos da torre) e o que pende abaixo dele. */
export interface HookReference {
  readonly frame: Transform
  /** Giro do referencial do gancho em torno de Y (graus). */
  readonly yawDeg: number
  /** Distância de G até a base do gancho, onde as lingas prendem (m). */
  readonly attachOffsetM: number
  /** Soma das alturas da cadeia de acessórios abaixo do gancho (m). */
  readonly accessoriesDropM: number
}

function normalizeDeg(deg: number): number {
  const wrapped = ((((deg + 180) % 360) + 360) % 360) - 180
  return Math.round(wrapped * 1000) / 1000
}

/** Ponto onde a cadeia termina (o gancho, sem acessórios), no mundo. */
export function hookEndPoint(hook: HookReference): Vec3 {
  const { pos } = hook.frame
  return { x: pos.x, y: pos.y - hook.attachOffsetM - hook.accessoriesDropM, z: pos.z }
}

export interface EngageCheck {
  /** Altura do fim do gancho acima do topo da carga (m); negativa = abaixo do topo. */
  readonly gapM: number
  /** Distância horizontal do fim do gancho ao centro da carga (m). */
  readonly offsetM: number
  readonly canEngage: boolean
}

/** O gancho está perto o bastante para engatar a carga que está no chão em `pose`? */
export function checkEngage(
  hook: HookReference,
  pose: GroundPose,
  size: LoadDimensions,
  terrain: TerrainSpec,
  obstacles: readonly Obstacle[] = [],
): EngageCheck {
  const end = hookEndPoint(hook)
  const topY = cargoBaseY(terrain, size, pose, obstacles) + size.heightM
  const gapM = end.y - topY
  const offsetM = Math.hypot(end.x - pose.x, end.z - pose.z)
  return {
    gapM,
    offsetM,
    canEngage:
      gapM <= ENGAGE_MAX_GAP_M &&
      gapM >= ENGAGE_MIN_GAP_M &&
      offsetM <= ENGAGE_HORIZONTAL_TOLERANCE_M,
  }
}

/**
 * Engata: a carga fica onde está e passa a seguir o gancho. Guarda o deslocamento e o giro em relação
 * a ele e a distância que havia entre o fim do gancho e o topo, que vira a altura das lingas (assim a
 * carga não pula nem entra no chão ao ser levantada).
 */
export function engageCargo(
  state: CargoState,
  hook: HookReference,
  size: LoadDimensions,
  terrain: TerrainSpec,
  obstacles: readonly Obstacle[] = [],
): CargoState {
  const check = checkEngage(hook, state, size, terrain, obstacles)
  const { pos } = hook.frame
  // Do mundo para o plano do gancho: gira de volta o giro do referencial.
  const local = mulVec(rotY(-hook.yawDeg * DEG), { x: state.x - pos.x, y: 0, z: state.z - pos.z })
  return {
    ...state,
    phase: 'hooked',
    hooked: {
      offsetX: Math.round(local.x * 1000) / 1000,
      offsetZ: Math.round(local.z * 1000) / 1000,
      yawDeg: normalizeDeg(state.rotationYDeg - hook.yawDeg),
      slingDropM: Math.max(MIN_SLING_DROP_M, Math.round(check.gapM * 1000) / 1000),
    },
  }
}

/** Centro e giro da carga engatada, no mundo. */
export function hookedCargoPose(hook: HookReference, hooked: HookedCargoPose): GroundPose {
  const { pos } = hook.frame
  const world = mulVec(rotY(hook.yawDeg * DEG), { x: hooked.offsetX, y: 0, z: hooked.offsetZ })
  return {
    x: pos.x + world.x,
    z: pos.z + world.z,
    rotationYDeg: normalizeDeg(hook.yawDeg + hooked.yawDeg),
  }
}

export interface ReleaseCheck {
  /** Altura da base da carga acima da superfície de apoio sob ela: o chão ou a carroceria (m). */
  readonly heightAboveGroundM: number
  /** Onde ela cairia. */
  readonly pose: GroundPose
  readonly canRelease: boolean
}

/** A carga engatada está perto o bastante da superfície de apoio (chão ou carroceria) para soltar? */
export function checkRelease(
  hook: HookReference,
  hooked: HookedCargoPose,
  size: LoadDimensions,
  terrain: TerrainSpec,
  obstacles: readonly Obstacle[] = [],
): ReleaseCheck {
  const pose = hookedCargoPose(hook, hooked)
  const bottomY =
    hook.frame.pos.y - hook.attachOffsetM - hook.accessoriesDropM - hooked.slingDropM - size.heightM
  const heightAboveGroundM = bottomY - cargoBaseY(terrain, size, pose, obstacles)
  return { heightAboveGroundM, pose, canRelease: heightAboveGroundM <= RELEASE_MAX_HEIGHT_M }
}

/** O centro da carga está dentro do raio do ponto de entrega? */
export function isInsideDelivery(pose: GroundPose, delivery: DeliveryPoint): boolean {
  return Math.hypot(pose.x - delivery.x, pose.z - delivery.z) <= delivery.radiusM
}

/**
 * Solta: a carga fica apoiada onde está, no chão ou na carroceria (sem deslizar). Dentro do raio do ponto de entrega, marca
 * "entregue" com o tempo da operação; fora dele, "fora do ponto de entrega". Sem ponto de entrega, só
 * apoia a carga.
 */
export function releaseCargo(
  state: CargoState,
  hook: HookReference,
  size: LoadDimensions,
  terrain: TerrainSpec,
  delivery: DeliveryPoint | null,
  elapsedMs: number | null,
  obstacles: readonly Obstacle[] = [],
): CargoState {
  if (state.phase !== 'hooked' || !state.hooked) return state
  const { pose } = checkRelease(hook, state.hooked, size, terrain, obstacles)
  const inside = delivery !== null && isInsideDelivery(pose, delivery)
  const result: DeliveryResult = delivery === null ? 'none' : inside ? 'delivered' : 'outside'
  return {
    phase: 'ground',
    x: Math.round(pose.x * 1000) / 1000,
    z: Math.round(pose.z * 1000) / 1000,
    rotationYDeg: pose.rotationYDeg,
    result,
    ...(result === 'delivered' && elapsedMs !== null ? { elapsedMs: Math.round(elapsedMs) } : {}),
  }
}

/** Engatar de novo depois de uma soltura: o resultado anterior deixa de valer. */
export function clearResult(state: CargoState): CargoState {
  const { elapsedMs: _elapsed, ...rest } = state
  void _elapsed
  return { ...rest, result: 'none' }
}

/** Situação para a interface, dado o estado, o gancho e o cenário. */
export function cargoStatusOf(
  state: CargoState,
  hook: HookReference,
  size: LoadDimensions,
  terrain: TerrainSpec,
  delivery: DeliveryPoint | null,
  obstacles: readonly Obstacle[] = [],
): CargoStatus {
  const base = { active: true, hasDelivery: delivery !== null, state }
  if (state.phase === 'ground') {
    const check = checkEngage(hook, state, size, terrain, obstacles)
    return {
      ...base,
      canEngage: check.canEngage,
      canRelease: false,
      gapM: check.gapM,
      offsetM: check.offsetM,
      heightAboveGroundM: null,
      distanceToDeliveryM: null,
      bed: bedStatusAt(state, terrain, obstacles),
    }
  }
  if (!state.hooked) return { ...INACTIVE_CARGO, ...base }
  const check = checkRelease(hook, state.hooked, size, terrain, obstacles)
  return {
    ...base,
    canEngage: false,
    canRelease: check.canRelease,
    gapM: null,
    offsetM: null,
    heightAboveGroundM: check.heightAboveGroundM,
    distanceToDeliveryM: delivery
      ? Math.hypot(check.pose.x - delivery.x, check.pose.z - delivery.z)
      : null,
    bed: bedStatusAt(check.pose, terrain, obstacles),
  }
}
