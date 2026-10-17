// Monta o estado enviado ao backend a partir dos sliders (estado aplicado na cena) e dos campos da
// tela (TASK-032); desde a TASK-033, o id é o da configuração escolhida no catálogo. Só confere a forma que o backend exige (id não vazio, carga finita e >= 0); as
// faixas do guindaste são validadas no backend, com a ficha técnica (RN-008; ADR-013 C-5).

import { type OutriggerState, residualSlopeDeg } from '../domain/crane/outriggers'
import type { SoilKind } from '../domain/environment/environment'
import type { EvaluationInput, OutriggerInput } from '../domain/evaluation/evaluation'
import type { CraneState } from '../three/crane/types'

/**
 * Inclinação que vai à avaliação (RN-013; TASK-094): a **residual**, o terreno sob o guindaste
 * menos o nivelamento dos macacos apoiados (`residualSlopeDeg`), em centésimos de grau como a
 * inclinação do cenário. Terreno plano continua `undefined` (o campo não vai ao backend).
 */
export function residualGroundSlopeDeg(
  terrainSlopeDeg: number | undefined,
  outriggers: OutriggerState,
): number | undefined {
  if (terrainSlopeDeg === undefined) return undefined
  return Math.round(residualSlopeDeg(terrainSlopeDeg, outriggers) * 100) / 100
}

export interface ScenarioEvaluationExtras {
  readonly soilKinds?: readonly SoilKind[]
  readonly windSpeedMs?: number
  /** Área de vento da carga `A_W` (TASK-106; RN-017), só com a carga pendurada. */
  readonly loadWindAreaM2?: number
  readonly obstacleConflicts?: readonly string[]
}

export type EvaluationInputResult =
  | { readonly input: EvaluationInput; readonly problem: null }
  | { readonly input: null; readonly problem: string }

export function buildEvaluationInput(
  craneState: CraneState | null,
  configurationId: string,
  loadWeightText: string,
  outriggers?: OutriggerInput,
  accessoryIds: readonly string[] = [],
  /**
   * Inclinação residual sob o guindaste (TASK-052; RN-013), já descontado o nivelamento
   * (`residualGroundSlopeDeg`); `undefined` com terreno plano.
   */
  groundSlopeDeg?: number,
  /** Solo, vento e conflitos com obstáculos (TASK-066); só vão ao backend quando existem. */
  scenarioExtras: ScenarioEvaluationExtras = {},
): EvaluationInputResult {
  if (craneState === null) return { input: null, problem: 'Aguardando a cena 3D.' }
  const trimmedId = configurationId.trim()
  if (trimmedId === '') {
    return {
      input: null,
      problem: 'Escolha a configuração (fabricante → guindaste → configuração) para avaliar.',
    }
  }
  const loadText = loadWeightText.trim()
  const loadWeightKg = loadText === '' ? Number.NaN : Number(loadText)
  if (!Number.isFinite(loadWeightKg) || loadWeightKg < 0) {
    return { input: null, problem: 'Informe o peso da carga em kg (número maior ou igual a 0).' }
  }
  return {
    input: {
      configurationId: trimmedId,
      boomLengthM: craneState.boomLengthM,
      boomAngleDeg: craneState.boomAngleDeg,
      turretRotationDeg: craneState.turretRotationDeg,
      cableLengthM: craneState.cableLengthM,
      loadWeightKg,
      ...(outriggers ? { outriggers } : {}),
      // Só vai ao backend com acessórios escolhidos (TASK-056; RN-014).
      ...(accessoryIds.length > 0 ? { accessoryIds } : {}),
      ...(groundSlopeDeg === undefined ? {} : { groundSlopeDeg }),
      ...(scenarioExtras.soilKinds ? { soilKinds: scenarioExtras.soilKinds } : {}),
      ...(scenarioExtras.windSpeedMs === undefined
        ? {}
        : { windSpeedMs: scenarioExtras.windSpeedMs }),
      ...(scenarioExtras.loadWindAreaM2 === undefined
        ? {}
        : { loadWindAreaM2: scenarioExtras.loadWindAreaM2 }),
      ...(scenarioExtras.obstacleConflicts && scenarioExtras.obstacleConflicts.length > 0
        ? { obstacleConflicts: scenarioExtras.obstacleConflicts }
        : {}),
    },
    problem: null,
  }
}
