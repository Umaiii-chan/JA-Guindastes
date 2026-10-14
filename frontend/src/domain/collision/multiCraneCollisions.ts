// Colisões entre dois guindastes e da carga içada em tandem (TASK-074; ADR-037; RN-012), sem
// Three.js. Reaproveita as caixas orientadas do corpo (`craneBodyObbs`), o terreno e os obstáculos
// de `collisions.ts`: lança contra lança, lança contra o corpo do outro e a carga contra o terreno,
// os obstáculos e o corpo dos dois guindastes. É PRÉ-VISUALIZAÇÃO e bloqueio de comando na cena
// (capacidade e segurança continuam sendo do backend; RN-008).

import type { CranePlacement, ScenarioSpec } from '../environment/environment'
import {
  type CollisionCraneState,
  type CollisionHit,
  type CollisionReport,
  type CraneBody,
  craneBodyObbs,
  obbTerrainDepth,
  obstacleObb,
} from './collisions'
import { type Obb, obbFromFrame, obbPenetration, rotY } from './obb'

const DEG = Math.PI / 180

export interface MultiCrane {
  /** Nome mostrado nas mensagens ("Guindaste 1"). */
  readonly label: string
  readonly placement: CranePlacement
  readonly state: CollisionCraneState
  /** Corpo medido no modelo; `null` desliga os testes contra este guindaste. */
  readonly body: CraneBody | null
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

/**
 * Colisões entre os guindastes (lança contra lança, lança contra corpo) e, com `cargo`, da carga
 * içada contra o terreno, os obstáculos e o corpo de cada guindaste. A soma das penetrações vai em
 * `penetrationM`, para a guarda de comandos poder sair de um estado que já colide.
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
          const part = `${first.crane.label}: ${a.id} × ${second.crane.label}: ${b.id}`
          hits.push({ subject: 'crane', target: { kind: 'other-crane', part, obb: b.obb } })
          hits.push({ subject: 'crane', target: { kind: 'other-crane', part, obb: a.obb } })
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
      const obstacleBox = obstacleObb(obstacle, scenario.terrain)
      const depth = obbPenetration(box, obstacleBox)
      if (depth > 0) {
        penetrationM += depth
        hits.push({
          subject: 'load',
          target: { kind: 'obstacle', id: obstacle.id, label: obstacle.label, obb: obstacleBox },
        })
      }
    }
    for (const { crane, obbs } of bodies) {
      for (const part of obbs) {
        const depth = obbPenetration(box, part.obb)
        if (depth > 0) {
          penetrationM += depth
          hits.push({
            subject: 'load',
            target: { kind: 'crane', part: `${crane.label}: ${part.id}`, obb: part.obb },
          })
        }
      }
    }
  }
  return { hits, alerts: [], penetrationM }
}
