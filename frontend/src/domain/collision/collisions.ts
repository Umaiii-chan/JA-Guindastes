// Colisões da carga (TASK-053; ADR-028; RN-012), sem Three.js: a carga suspensa, o gancho e a cadeia
// de acessórios (TASK-091) contra o terreno, o corpo do guindaste e os obstáculos; o cabo e a lança
// contra os obstáculos só geram alerta. É PRÉ-VISUALIZAÇÃO e bloqueio de comando na cena: capacidade
// e segurança continuam sendo do backend (RN-008).
//
// Referenciais: o guindaste fica em `scenario.crane` (eixo de giro em (x, z), apoiado no terreno nessa
// posição) com o chassi girado em `headingDeg` em torno de +Y (mesmo sentido de `rotation.y`; com 0°
// a cena fica como a original, sem rotação). O gancho G, a ponta T e o pino P vêm da geometria
// operacional do ADR-013 (fórmulas 1 a 5); o corpo, das caixas medidas nos nós do rig.

import {
  calculateOperationalGeometry,
  type CraneGeometryParameters,
  type Point3,
} from '../geometry/operationalGeometry'
import {
  type Obstacle,
  type ScenarioSpec,
  type TerrainSpec,
  terrainHeightAt,
} from '../environment/environment'
import { findLibraryObject, scaledCollisionBoxes } from '../environment/objectLibrary'
import type { LoadBoxLayout } from './loadBox'
import {
  applyTransform,
  type Obb,
  obbFromFrame,
  obbPenetration,
  rotX,
  rotY,
  segmentIntersectsObb,
  type Transform,
  type Vec3,
  compose,
  IDENTITY,
} from './obb'
import { obbTerrainDepth } from './terrainSampling'

export { obbTerrainDepth, TERRAIN_TOLERANCE_M } from './terrainSampling'

const DEG = Math.PI / 180

/** Id do obstáculo que representa a carga apoiada no chão, enquanto ela não está engatada (TASK-073). */
export const GROUND_CARGO_ID = 'carga-no-chao'

/** Estado do guindaste que importa aqui: os mesmos ψ, θ, L e c do `CraneState`. */
export interface CollisionCraneState {
  readonly turretRotationDeg: number
  readonly boomAngleDeg: number
  readonly boomLengthM: number
  readonly cableLengthM: number
}

/** Nó do rig a que uma caixa do corpo pertence (hierarquia base → torre → lança → extensão). */
export type BodyFrame = 'base' | 'turret' | 'boom' | 'boomExtension'

/** Caixa alinhada aos eixos do nó (`frame`), com centro e meias-medidas no referencial dele. */
export interface BodyBox {
  readonly id: string
  readonly frame: BodyFrame
  readonly center: Vec3
  readonly half: Vec3
}

/**
 * Corpo do guindaste como caixas por nó (medidas no rig, em `three/crane/craneBody.ts`) e as posições
 * estáticas dos nós: torre na base, pino da lança na torre e a extensão na lança.
 */
export interface CraneBody {
  readonly boxes: readonly BodyBox[]
  readonly turretOffset: Vec3
  readonly boomPivot: Vec3
  readonly extensionOffset: Vec3
  /** Lança recolhida do modelo (m): a extensão fica em `extensionOffset` com L igual a isto. */
  readonly boomRetractedLengthM: number
}

/** Caixa do gancho (centro e meias-medidas nos eixos locais de G). */
export interface HookBox {
  readonly center: Vec3
  readonly half: Vec3
}

/**
 * Cadeia de acessórios abaixo do gancho (TASK-056; TASK-091): começa no ponto de amarração (`topM`
 * abaixo de G) e desce `dropM` (a soma de `riggingHeightM`, a mesma distância que a cena usa para
 * descer a carga).
 */
export interface AccessoryChainSpan {
  readonly topM: number
  readonly dropM: number
}

/**
 * Meia-largura (m) da caixa da cadeia de acessórios. FICTÍCIO (ADR-012): o catálogo só tem a altura
 * de cada acessório (`riggingHeightM`), não a largura; 0,3 m cobre gancho giratório e manilha.
 */
export const ACCESSORY_CHAIN_HALF_WIDTH_M = 0.15

/**
 * Meia-largura (m) da caixa do cabo, do gancho à ponta da lança, contra a lança de outro guindaste
 * (TASK-091). FICTÍCIO (ADR-012): o cabo real é mais fino, mas tem várias pernas (moitão).
 */
export const CABLE_HALF_WIDTH_M = 0.05

export interface CollisionInput {
  readonly state: CollisionCraneState
  readonly geometryParameters: CraneGeometryParameters
  readonly scenario: ScenarioSpec
  /** Corpo do guindaste; `null` desliga o teste contra o corpo. */
  readonly body: CraneBody | null
  /** Caixa da carga pendurada (já com as lingas), ou `null` sem carga. */
  readonly load: LoadBoxLayout | null
  /** Caixa do gancho, ou `null` se ainda não foi medida. */
  readonly hook: HookBox | null
  /** Cadeia de acessórios (TASK-091); ausente, `null` ou sem altura = sem cadeia. */
  readonly chain?: AccessoryChainSpan | null
}

/**
 * O que colide: a carga, o gancho, a cadeia de acessórios (TASK-091), o cabo (só contra a lança de
 * outro guindaste; TASK-091) ou, com dois guindastes (TASK-074), o próprio guindaste (lança contra
 * lança, lança contra o corpo do outro).
 */
export type CollisionSubject = 'load' | 'hook' | 'accessories' | 'cable' | 'crane'

export type CollisionTarget =
  | { readonly kind: 'terrain' }
  | { readonly kind: 'crane'; readonly part: string; readonly obb: Obb }
  | { readonly kind: 'obstacle'; readonly id: string; readonly label: string; readonly obb: Obb }
  /** Outro guindaste do cenário (TASK-074); `part` diz quais peças se tocam. */
  | { readonly kind: 'other-crane'; readonly part: string; readonly obb: Obb }
  /** No tandem, o guindaste que acompanha não alcança o ponto de içamento dele (TASK-074). */
  | { readonly kind: 'tandem-reach'; readonly craneLabel: string }

/** O que encostou em quê (a carga, o gancho, a cadeia, o cabo ou o guindaste). */
export interface CollisionHit {
  readonly subject: CollisionSubject
  readonly target: CollisionTarget
  /**
   * Com vários guindastes (TASK-091): nome do guindaste dono da carga, do gancho, da cadeia ou do cabo
   * que encostou no outro. Ausente = o guindaste da própria guarda.
   */
  readonly owner?: string
}

/** Cabo ou lança atravessando um obstáculo: só alerta, não bloqueia (RN-012). */
export interface CollisionAlert {
  readonly segment: 'cable' | 'boom'
  readonly obstacleId: string
  readonly label: string
}

export interface CollisionReport {
  readonly hits: readonly CollisionHit[]
  readonly alerts: readonly CollisionAlert[]
  /**
   * Soma (m) das profundidades de penetração (terreno, corpo, obstáculos); 0 sem colisão. A guarda usa
   * isto quando o estado de partida já colide: só aceita comandos que não aumentem a penetração.
   */
  readonly penetrationM: number
}

/**
 * Estado de colisão que a UI e a gravação (TASK-057) recebem. `blocked` é verdadeiro quando o último
 * comando foi cortado no último estado seguro; nesse caso `hits` é o que o comando recusado atingiria.
 */
export interface CollisionState extends CollisionReport {
  readonly blocked: boolean
}

export const NO_COLLISION: CollisionState = {
  hits: [],
  alerts: [],
  penetrationM: 0,
  blocked: false,
}

/** Posição e rumo do guindaste no mundo: referencial da base (origem em O, no terreno). */
export function craneBaseTransform(scenario: ScenarioSpec): Transform {
  const { x, z, headingDeg } = scenario.crane
  return {
    rot: rotY(headingDeg * DEG),
    pos: { x, y: terrainHeightAt(scenario.terrain, x, z), z },
  }
}

/** Obstáculo como caixa: base na altura do terreno no centro (mais `baseElevationM`, se houver); cilindro vira a caixa que o envolve. */
export function obstacleObb(obstacle: Obstacle, terrain: TerrainSpec): Obb {
  const ground =
    terrainHeightAt(terrain, obstacle.centerX, obstacle.centerZ) + (obstacle.baseElevationM ?? 0)
  const isCylinder = obstacle.kind === 'cylinder'
  const frame: Transform = {
    rot: isCylinder ? IDENTITY : rotY(obstacle.rotationYDeg * DEG),
    pos: { x: obstacle.centerX, y: ground, z: obstacle.centerZ },
  }
  return obbFromFrame(
    frame,
    { x: 0, y: obstacle.heightM / 2, z: 0 },
    {
      x: obstacle.widthM / 2,
      y: obstacle.heightM / 2,
      z: (isCylinder ? obstacle.widthM : obstacle.depthM) / 2,
    },
  )
}

/**
 * Caixas de colisão de um obstáculo no mundo. Caixa e cilindro dão uma só (`obstacleObb`); um objeto da
 * biblioteca (TASK-072) dá as caixas dele (paredes, teto e a abertura do barracão, por exemplo), cada
 * uma escalada para o tamanho do obstáculo e girada com ele em torno do centro da planta, com a base na
 * altura do terreno no centro. Um `modelId` que a biblioteca não conhece volta à caixa que o envolve.
 */
export function obstacleObbs(obstacle: Obstacle, terrain: TerrainSpec): readonly Obb[] {
  const object = obstacle.kind === 'model' ? findLibraryObject(obstacle.modelId) : undefined
  if (!object) return [obstacleObb(obstacle, terrain)]
  const ground = terrainHeightAt(terrain, obstacle.centerX, obstacle.centerZ)
  const frame: Transform = {
    rot: rotY(obstacle.rotationYDeg * DEG),
    pos: { x: obstacle.centerX, y: ground, z: obstacle.centerZ },
  }
  return scaledCollisionBoxes(obstacle, object).map((box) =>
    obbFromFrame(
      frame,
      { x: box.x, y: box.y + box.h / 2, z: box.z },
      { x: box.w / 2, y: box.h / 2, z: box.d / 2 },
    ),
  )
}

/** Caixas do corpo do guindaste no mundo, para o estado dado. */
export function craneBodyObbs(
  body: CraneBody,
  state: CollisionCraneState,
  scenario: ScenarioSpec,
): { readonly id: string; readonly frame: BodyFrame; readonly obb: Obb }[] {
  const base = craneBaseTransform(scenario)
  const turret = compose(base, { rot: rotY(state.turretRotationDeg * DEG), pos: body.turretOffset })
  const boom = compose(turret, { rot: rotX(-state.boomAngleDeg * DEG), pos: body.boomPivot })
  const extension = compose(boom, {
    rot: IDENTITY,
    pos: {
      x: body.extensionOffset.x,
      y: body.extensionOffset.y,
      z: body.extensionOffset.z + state.boomLengthM - body.boomRetractedLengthM,
    },
  })
  const frames: Record<BodyFrame, Transform> = { base, turret, boom, boomExtension: extension }
  return body.boxes.map((box) => ({
    id: box.id,
    frame: box.frame,
    obb: obbFromFrame(frames[box.frame], box.center, box.half),
  }))
}

/** Pontos G, T e P no mundo e o referencial do gancho (eixos da torre, origem em G). */
function suspension(input: Pick<CollisionInput, 'state' | 'geometryParameters' | 'scenario'>): {
  hookFrame: Transform
  hook: Vec3
  tip: Vec3
  pivot: Vec3
} {
  const base = craneBaseTransform(input.scenario)
  const geometry = calculateOperationalGeometry(input.state, input.geometryParameters)
  const toWorld = (p: Point3): Vec3 => applyTransform(base, { x: p.xM, y: p.yM, z: p.zM })
  const hook = toWorld(geometry.hook)
  const turretRot = compose(base, { rot: rotY(input.state.turretRotationDeg * DEG), pos: ZERO })
  return {
    hookFrame: { rot: turretRot.rot, pos: hook },
    hook,
    tip: toWorld(geometry.boomTip),
    pivot: toWorld(geometry.boomPivot),
  }
}

const ZERO: Vec3 = { x: 0, y: 0, z: 0 }

/**
 * Referencial do gancho no mundo (origem em G; eixos da torre, com Y para cima) e o giro dele em
 * torno de Y (graus: rumo do chassi mais o giro da torre). Usado para engatar e soltar a carga
 * (TASK-073; ADR-035).
 */
export function hookWorldFrame(
  input: Pick<CollisionInput, 'state' | 'geometryParameters' | 'scenario'>,
): { readonly frame: Transform; readonly yawDeg: number } {
  return {
    frame: suspension(input).hookFrame,
    yawDeg: input.scenario.crane.headingDeg + input.state.turretRotationDeg,
  }
}

/** Caixa da cadeia de acessórios nos eixos locais de G (de G − `topM` até G − `topM` − `dropM`), ou `null`. */
export function accessoryChainBox(chain: AccessoryChainSpan | null | undefined): HookBox | null {
  if (!chain || !(chain.dropM > 0) || !Number.isFinite(chain.dropM)) return null
  const top = Number.isFinite(chain.topM) && chain.topM > 0 ? chain.topM : 0
  return {
    center: { x: 0, y: -(top + chain.dropM / 2), z: 0 },
    half: {
      x: ACCESSORY_CHAIN_HALF_WIDTH_M,
      y: chain.dropM / 2,
      z: ACCESSORY_CHAIN_HALF_WIDTH_M,
    },
  }
}

/**
 * Caixa da carga, do gancho e da cadeia de acessórios no mundo. O cabo pende na vertical (S-2), então
 * os eixos são os da torre (girada em ψ) com Y para cima, como no nó do gancho da cena.
 */
export function payloadObbs(
  input: CollisionInput,
): { readonly subject: CollisionSubject; readonly obb: Obb }[] {
  const { hookFrame } = suspension(input)
  const parts: { subject: CollisionSubject; obb: Obb }[] = []
  if (input.hook) {
    parts.push({
      subject: 'hook',
      obb: obbFromFrame(hookFrame, input.hook.center, input.hook.half),
    })
  }
  // TASK-091 (F-10; RN-012): a cadeia (gancho giratório, manilha…) também não atravessa nada.
  const chain = accessoryChainBox(input.chain)
  if (chain) {
    parts.push({ subject: 'accessories', obb: obbFromFrame(hookFrame, chain.center, chain.half) })
  }
  if (input.load) {
    const { center, size, yawDeg } = input.load
    const half = { x: size.x / 2, y: size.y / 2, z: size.z / 2 }
    if (yawDeg === undefined) {
      parts.push({ subject: 'load', obb: obbFromFrame(hookFrame, center, half) })
    } else {
      // Carga engatada fora do eixo e girada (TASK-073): a caixa gira em torno do próprio centro.
      const frame = compose(hookFrame, {
        rot: rotY(yawDeg * DEG),
        pos: { x: center.x, y: 0, z: center.z },
      })
      parts.push({ subject: 'load', obb: obbFromFrame(frame, { x: 0, y: center.y, z: 0 }, half) })
    }
  }
  return parts
}

/**
 * Caixa fina do cabo, de G até a ponta T (vertical, S-2), para conferir contra a lança de outro
 * guindaste (TASK-091); `null` sem cabo abaixo da ponta.
 */
export function cableObb(
  input: Pick<CollisionInput, 'state' | 'geometryParameters' | 'scenario'>,
): Obb | null {
  const { hookFrame, hook, tip } = suspension(input)
  const lengthM = tip.y - hook.y
  if (!(lengthM > 0)) return null
  return obbFromFrame(
    hookFrame,
    { x: 0, y: lengthM / 2, z: 0 },
    { x: CABLE_HALF_WIDTH_M, y: lengthM / 2, z: CABLE_HALF_WIDTH_M },
  )
}

/** A caixa entra no terreno? Compara a face de baixo (e os picos das feições) com o terreno. */
export function obbHitsTerrain(obb: Obb, terrain: TerrainSpec): boolean {
  return obbTerrainDepth(obb, terrain) > 0
}

/**
 * Frames do corpo que o gancho e a cadeia de acessórios não podem atravessar (a lança é onde o gancho
 * fica preso por construção, e a cadeia pende logo abaixo dele).
 */
const HOOK_SOLID_FRAMES: ReadonlySet<BodyFrame> = new Set<BodyFrame>(['base', 'turret'])

/**
 * Avalia o estado: o que a carga, o gancho e a cadeia de acessórios atingem e o que o cabo e a lança
 * atravessam. O gancho e a cadeia são testados contra o terreno, os obstáculos e o chassi/torre (não
 * contra a lança, onde o gancho fica preso por construção).
 */
export function evaluateCollisions(input: CollisionInput): CollisionReport {
  const { scenario } = input
  const hits: CollisionHit[] = []
  const obstacles = scenario.obstacles.map((obstacle) => ({
    obstacle,
    obbs: obstacleObbs(obstacle, scenario.terrain),
  }))
  const bodyObbs = input.body ? craneBodyObbs(input.body, input.state, scenario) : []

  let penetrationM = 0
  for (const { subject, obb } of payloadObbs(input)) {
    const terrainDepth = obbTerrainDepth(obb, scenario.terrain)
    if (terrainDepth > 0) {
      hits.push({ subject, target: { kind: 'terrain' } })
      penetrationM += terrainDepth
    }
    for (const part of bodyObbs) {
      if (subject !== 'load' && !HOOK_SOLID_FRAMES.has(part.frame)) continue
      const depth = obbPenetration(obb, part.obb)
      if (depth > 0) {
        hits.push({ subject, target: { kind: 'crane', part: part.id, obb: part.obb } })
        penetrationM += depth
      }
    }
    for (const { obstacle, obbs } of obstacles) {
      for (const obstacleBox of obbs) {
        const depth = obbPenetration(obb, obstacleBox)
        if (depth > 0) {
          penetrationM += depth
          hits.push({
            subject,
            target: { kind: 'obstacle', id: obstacle.id, label: obstacle.label, obb: obstacleBox },
          })
        }
      }
    }
  }

  const alerts: CollisionAlert[] = []
  if (obstacles.length > 0) {
    const { hook, tip, pivot } = suspension(input)
    for (const { obstacle, obbs } of obstacles) {
      const entry = { obstacleId: obstacle.id, label: obstacle.label }
      if (obbs.some((obb) => segmentIntersectsObb(tip, hook, obb))) {
        alerts.push({ segment: 'cable', ...entry })
      }
      if (obbs.some((obb) => segmentIntersectsObb(pivot, tip, obb))) {
        alerts.push({ segment: 'boom', ...entry })
      }
    }
  }
  return { hits, alerts, penetrationM }
}

/** Alvo legível em português, para a UI e o handoff. */
export function describeTarget(target: CollisionTarget): string {
  switch (target.kind) {
    case 'terrain':
      return 'o terreno'
    case 'crane':
      return 'o guindaste'
    case 'obstacle':
      return target.id === GROUND_CARGO_ID ? 'a carga no chão' : `o obstáculo «${target.label}»`
    case 'other-crane':
      return `o outro guindaste (${target.part})`
    case 'tandem-reach':
      return `o limite de alcance do ${target.craneLabel}`
  }
}

const SUBJECT_NAMES: Readonly<Record<Exclude<CollisionSubject, 'crane'>, string>> = {
  load: 'A carga',
  hook: 'O gancho',
  accessories: 'A cadeia de acessórios',
  cable: 'O cabo',
}

export function describeHit(hit: CollisionHit): string {
  if (hit.target.kind === 'tandem-reach') {
    return `O ${hit.target.craneLabel} não alcançaria o ponto de içamento dele.`
  }
  if (hit.subject === 'crane') return `Os guindastes colidiriam: ${describeTarget(hit.target)}.`
  const owner = hit.owner ? ` do ${hit.owner}` : ''
  return `${SUBJECT_NAMES[hit.subject]}${owner} atingiria ${describeTarget(hit.target)}.`
}

export function describeAlert(alert: CollisionAlert): string {
  if (alert.obstacleId === GROUND_CARGO_ID) {
    return `${alert.segment === 'cable' ? 'O cabo' : 'A lança'} atravessa a carga no chão.`
  }
  const segment = alert.segment === 'cable' ? 'O cabo' : 'A lança'
  return `${segment} atravessa o obstáculo «${alert.label}».`
}

/** Chave estável do conteúdo (sem as caixas), para avisar a UI só quando algo mudou. */
export function collisionStateKey(state: CollisionState): string {
  const hits = state.hits.map((hit) => {
    const subject = hit.owner ? `${hit.subject}@${hit.owner}` : hit.subject
    return hit.target.kind === 'terrain'
      ? `${subject}:terrain`
      : hit.target.kind === 'crane'
        ? `${subject}:crane:${hit.target.part}`
        : hit.target.kind === 'other-crane'
          ? `${subject}:other-crane:${hit.target.part}`
          : hit.target.kind === 'tandem-reach'
            ? `${subject}:tandem-reach:${hit.target.craneLabel}`
            : `${subject}:obstacle:${hit.target.id}`
  })
  const alerts = state.alerts.map((alert) => `${alert.segment}:${alert.obstacleId}`)
  return JSON.stringify([state.blocked, hits, alerts])
}
