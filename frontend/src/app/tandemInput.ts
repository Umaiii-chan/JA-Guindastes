// Monta o pedido de `POST /api/v1/evaluations/tandem` a partir do quadro do tandem engatado (TASK-074)
// e do ambiente de cada guindaste (TASK-090; RN-014, RN-015, RN-016). Só monta: quem divide a carga,
// aplica os 75 % e confere o gancho sobre o ponto é o backend (RN-008).
//
// - Guindaste 1 (conduz): o mesmo ambiente da avaliação individual (`buildEvaluationInput`), com a
//   cadeia de acessórios da tela, as patolas dele, a inclinação, o solo e os obstáculos.
// - Guindaste 2 (acompanha): o ambiente pela posição dele no cenário. As patolas são as da cena
//   (sempre estendidas e apoiadas, ADR-037) e não há cadeia de acessórios (a tela só tem a do 1).
// - Vento: do local, comum aos dois.
// - Pontos de içamento: os da carga içada, não a posição dos ganchos; assim o backend confere se
//   cada gancho está mesmo sobre o ponto dele.

import { scenarioGroundSlopeDeg } from '../application/environment/scenarioEditing'
import { soilKindsUnderShoes, windSpeedForEvaluation } from '../application/environment/editorOps'
import {
  obstacleConflictIds,
  obstacleConflictLabels,
} from '../application/environment/obstacleConflicts'
import { NO_COLLISION } from '../domain/collision/collisions'
import type {
  CargoPlacement,
  CranePlacement,
  ScenarioSpec,
} from '../domain/environment/environment'
import type { EvaluationInput, OutriggerInput } from '../domain/evaluation/evaluation'
import {
  calculateOperationalGeometry,
  type CraneGeometryParameters,
} from '../domain/geometry/operationalGeometry'
import {
  cargoCgWorld,
  liftPointsWorld,
  type TandemCraneState,
  type TandemLoad,
} from '../domain/tandem/tandem'
import type { TandemCraneEnvironment, TandemInput } from '../domain/tandem/tandemEvaluation'

/** Patolas do guindaste adicional na cena: sempre estendidas e apoiadas (`ExtraCrane`; ADR-037). */
export const EXTRA_CRANE_OUTRIGGERS: OutriggerInput = { extensionPercent: 100, jacksSet: true }

export interface TandemInputSource {
  /** Quadro do tandem engatado: os dois estados e a carga içada. */
  readonly frame: {
    readonly leaderState: TandemCraneState
    readonly followerState: TandemCraneState
    readonly cargo: CargoPlacement
  }
  readonly load: TandemLoad
  readonly loadWeightKg: number
  readonly spec: ScenarioSpec
  readonly leader: {
    readonly configurationId: string
    readonly placement: CranePlacement
    /** Pedido da avaliação individual do guindaste 1 (ambiente e acessórios), ou `null`. */
    readonly evaluation: EvaluationInput | null
  }
  readonly follower: {
    readonly configurationId: string
    readonly placement: CranePlacement
    readonly parameters: CraneGeometryParameters
  }
}

/** Ambiente do guindaste 1: os mesmos campos que a avaliação individual dele manda. */
function leaderEnvironment(evaluation: EvaluationInput | null): TandemCraneEnvironment {
  if (!evaluation) return {}
  const { outriggers, groundSlopeDeg, accessoryIds, soilKinds, obstacleConflicts } = evaluation
  return {
    ...(outriggers && { outriggers }),
    ...(groundSlopeDeg !== undefined && { groundSlopeDeg }),
    ...(accessoryIds && { accessoryIds }),
    ...(soilKinds && { soilKinds }),
    ...(obstacleConflicts && { obstacleConflicts }),
  }
}

/**
 * Ambiente do guindaste 2, pela posição dele: inclinação e solo sob as sapatas dele e os obstáculos
 * no raio de giro dele. A colisão da cena não entra aqui (o estado de colisão da tela mistura os
 * guindastes), só o raio.
 */
function followerEnvironment(source: TandemInputSource): TandemCraneEnvironment {
  const spec: ScenarioSpec = { ...source.spec, crane: source.follower.placement }
  const radius = calculateOperationalGeometry(
    source.frame.followerState,
    source.follower.parameters,
  ).workingRadiusM
  const slope = scenarioGroundSlopeDeg(spec)
  const soil = soilKindsUnderShoes(spec)
  const conflicts = obstacleConflictLabels(spec, obstacleConflictIds(spec, radius, NO_COLLISION))
  return {
    outriggers: EXTRA_CRANE_OUTRIGGERS,
    ...(slope !== undefined && { groundSlopeDeg: slope }),
    ...(soil && { soilKinds: soil }),
    ...(conflicts.length > 0 && { obstacleConflicts: conflicts }),
  }
}

export function buildTandemInput(source: TandemInputSource): TandemInput {
  const { frame, load, leader, follower } = source
  const [point1, point2] = liftPointsWorld(frame.cargo, load)
  const wind = windSpeedForEvaluation(source.spec)
  return {
    loadWeightKg: source.loadWeightKg,
    loadCg: cargoCgWorld(frame.cargo, load),
    ...(wind !== undefined && { windSpeedMs: wind }),
    cranes: [
      {
        configurationId: leader.configurationId,
        placement: leader.placement,
        state: frame.leaderState,
        hookPoint: { x: point1.x, z: point1.z },
        ...leaderEnvironment(leader.evaluation),
      },
      {
        configurationId: follower.configurationId,
        placement: follower.placement,
        state: frame.followerState,
        hookPoint: { x: point2.x, z: point2.z },
        ...followerEnvironment(source),
      },
    ],
  }
}
