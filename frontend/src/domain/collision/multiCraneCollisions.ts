// Colisões entre guindastes e da carga içada em tandem (TASK-074; ADR-037; RN-012), sem Three.js.
// Reaproveita as caixas orientadas do corpo (`craneBodyObbs`), a carga, o gancho e a cadeia de
// acessórios de cada guindaste (`payloadObbs`), o terreno e os obstáculos de `collisions.ts`: lança
// contra lança, lança contra o corpo do outro, a carga, o gancho e a cadeia de um guindaste contra o
// corpo dos outros e o cabo contra a lança dos outros (TASK-091, mesmo fora do tandem), e a carga do
// tandem contra o terreno, os obstáculos e o corpo dos dois guindastes. É PRÉ-VISUALIZAÇÃO e bloqueio
// de comando na cena (capacidade e segurança continuam sendo do backend; RN-008).

import type { CranePlacement, ScenarioSpec } from '../environment/environment'
import {
  type CollisionCraneState,
  type BodyFrame,
  type CollisionHit,
  type CollisionInput,
  type CollisionReport,
  type CraneBody,
  cableObb,
  craneBodyObbs,
  obbTerrainDepth,
  obstacleObbs,
  payloadObbs,
} from './collisions'
import { type Obb, obbFromFrame, obbPenetration, rotY } from './obb'

/** Nome da peça do guindaste para as mensagens (a tela não mostra nomes de nós do modelo). */
const PART_NAMES: Readonly<Record<BodyFrame, string>> = {
  base: 'chassi',
  turret: 'torre',
  boom: 'lança',
  boomExtension: 'extensão da lança',
}

/** Peças em que o cabo de outro guindaste pode encostar (o resto, a carga e o gancho tocam antes). */
const BOOM_FRAMES: ReadonlySet<BodyFrame> = new Set<BodyFrame>(['boom', 'boomExtension'])

const DEG = Math.PI / 180

/**
 * O que pende do guindaste (TASK-091): a geometria a/h, a caixa da carga, a do gancho e a cadeia de
 * acessórios, como a guarda do próprio guindaste os vê (`SceneCollisions`).
 */
export type CranePayload = Pick<CollisionInput, 'geometryParameters' | 'load' | 'hook' | 'chain'>

export interface MultiCrane {
  /** Nome mostrado nas mensagens ("Guindaste 1"). */
  readonly label: string
  readonly placement: CranePlacement
  readonly state: CollisionCraneState
  /** Corpo medido no modelo; `null` desliga os testes contra este guindaste. */
  readonly body: CraneBody | null
  /** Carga, gancho e cadeia pendurados (TASK-091); ausente ou `null` = nada contra os outros. */
  readonly payload?: CranePayload | null
}

/** Carga içada: centro (x, z), giro, altura da base e medidas. */
export interface HoistedCargo {
  readonly x: number
  readonly z: number
  readonly rotationYDeg: number
  readonly bottomY: number
  readonly lengthM: number
  readonly widthM: number
  readonly heightM: number
}

export interface MultiCraneInput {
  /** Terreno e obstáculos (a posição de `scenario.crane` não é usada: cada guindaste traz a dele). */
  readonly scenario: ScenarioSpec
  readonly cranes: readonly MultiCrane[]
  /** Carga içada pelos dois (tandem), ou `null`. */
  readonly cargo: HoistedCargo | null
}

export function cargoObb(cargo: HoistedCargo): Obb {
  return obbFromFrame(
    {
      rot: rotY(cargo.rotationYDeg * DEG),
      pos: { x: cargo.x, y: cargo.bottomY + cargo.heightM / 2, z: cargo.z },
    },
    { x: 0, y: 0, z: 0 },
    { x: cargo.widthM / 2, y: cargo.heightM / 2, z: cargo.lengthM / 2 },
  )
}

interface Suspended {
  readonly subject: CollisionHit['subject']
  readonly obb: Obb
  /** Peças do outro guindaste contra as quais esta caixa é conferida (`null` = todas). */
  readonly frames: ReadonlySet<BodyFrame> | null
}

/** Carga, gancho e cadeia (contra o corpo inteiro) e o cabo (só contra a lança) de um guindaste. */
function suspendedOf(crane: MultiCrane, scenario: ScenarioSpec): Suspended[] {
  const payload = crane.payload
  if (!payload) return []
  const input: CollisionInput = {
    state: crane.state,
    geometryParameters: payload.geometryParameters,
    scenario: { ...scenario, crane: crane.placement },
    body: null,
    load: payload.load,
    hook: payload.hook,
    chain: payload.chain ?? null,
  }
  const parts: Suspended[] = payloadObbs(input).map(({ subject, obb }) => ({
    subject,
    obb,
    frames: null,
  }))
  const cable = cableObb(input)
  if (cable) parts.push({ subject: 'cable', obb: cable, frames: BOOM_FRAMES })
  return parts
}

/**
 * Colisões entre os guindastes (lança contra lança, lança contra corpo; a carga, o gancho, a cadeia e
 * o cabo de cada um contra o outro) e, com `cargo`, da carga içada contra o terreno, os obstáculos e
 * o corpo de cada guindaste. A soma das penetrações vai em `penetrationM`, para a guarda de comandos
 * poder sair de um estado que já colide.
 */
export function evaluateMultiCraneCollisions(input: MultiCraneInput): CollisionReport {
  const { scenario, cranes, cargo } = input
  const hits: CollisionHit[] = []
  let penetrationM = 0

  const bodies = cranes.map((crane) => ({
    crane,
    obbs: crane.body
      ? craneBodyObbs(crane.body, crane.state, { ...scenario, crane: crane.placement })
      : [],
    suspended: suspendedOf(crane, scenario),
  }))

  for (let i = 0; i < bodies.length; i += 1) {
    for (let j = i + 1; j < bodies.length; j += 1) {
      const first = bodies[i]
      const second = bodies[j]
      if (!first || !second) continue
      for (const a of first.obbs) {
        for (const b of second.obbs) {
          const depth = obbPenetration(a.obb, b.obb)
          if (depth <= 0) continue
          penetrationM += depth
          const part = `${PART_NAMES[a.frame]} do ${first.crane.label} × ${PART_NAMES[b.frame]} do ${second.crane.label}`
          // Uma entrada por peça atingida: o destaque contorna as duas.
          hits.push({ subject: 'crane', target: { kind: 'other-crane', part, obb: b.obb } })
          hits.push({ subject: 'crane', target: { kind: 'other-crane', part, obb: a.obb } })
        }
      }
    }
  }

  // TASK-091 (F-07; RN-012): o que pende de um guindaste não atravessa os outros, com ou sem tandem.
  for (const owner of bodies) {
    for (const other of bodies) {
      if (other === owner) continue
      for (const piece of owner.suspended) {
        for (const part of other.obbs) {
          if (piece.frames && !piece.frames.has(part.frame)) continue
          const depth = obbPenetration(piece.obb, part.obb)
          if (depth <= 0) continue
          penetrationM += depth
          hits.push({
            subject: piece.subject,
            owner: owner.crane.label,
            target: {
              kind: 'other-crane',
              part: `${PART_NAMES[part.frame]} do ${other.crane.label}`,
              obb: part.obb,
            },
          })
        }
      }
    }
  }

  if (cargo) {
    const box = cargoObb(cargo)
    const terrainDepth = obbTerrainDepth(box, scenario.terrain)
    if (terrainDepth > 0) {
      hits.push({ subject: 'load', target: { kind: 'terrain' } })
      penetrationM += terrainDepth
    }
    for (const obstacle of scenario.obstacles) {
      // TASK-091 (F-23): as caixas detalhadas do objeto da biblioteca, como no guindaste único.
      for (const obstacleBox of obstacleObbs(obstacle, scenario.terrain)) {
        const depth = obbPenetration(box, obstacleBox)
        if (depth > 0) {
          penetrationM += depth
          hits.push({
            subject: 'load',
            target: { kind: 'obstacle', id: obstacle.id, label: obstacle.label, obb: obstacleBox },
          })
        }
      }
    }
    for (const { crane, obbs } of bodies) {
      for (const part of obbs) {
        const depth = obbPenetration(box, part.obb)
        if (depth > 0) {
          penetrationM += depth
          hits.push({
            subject: 'load',
            target: {
              kind: 'crane',
              part: `${PART_NAMES[part.frame]} do ${crane.label}`,
              obb: part.obb,
            },
          })
        }
      }
    }
  }
  return { hits, alerts: [], penetrationM }
}
