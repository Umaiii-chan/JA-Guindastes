// Monta o estado enviado ao backend a partir dos sliders (estado aplicado na cena) e dos campos da
// tela (TASK-032); desde a TASK-033, o id é o da configuração escolhida no catálogo. Só confere a forma que o backend exige (id não vazio, carga finita e >= 0); as
// faixas do guindaste são validadas no backend, com a ficha técnica (RN-008; ADR-013 C-5).

import { type OutriggerState, residualSlopeDeg } from '../domain/crane/outriggers'
import type { ScenarioSpec, SoilKind } from '../domain/environment/environment'
import type {
  EvaluationInput,
  EvaluationSite,
  OutriggerInput,
} from '../domain/evaluation/evaluation'
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
  readonly obstacleConflicts?: readonly string[]
  /** Rede elétrica e contexto do içamento (TASK-107; ADR-051). */
  readonly site?: EvaluationSite
}

export interface SiteInputs {
  readonly spec: ScenarioSpec
  /** Medidas da carga válida (m); sem elas, a carga não entra na distância à rede. */
  readonly load: {
    readonly lengthM: number
    readonly widthM: number
    readonly heightM: number
  } | null
  readonly tandem: boolean
  readonly loadOverOccupied: boolean
  /** Do gancho ao ponto de amarração das lingas, medido na cena (m); ausente = padrão do servidor. */
  readonly hookAttachM?: number | null
}

/**
 * O local da operação que vai à avaliação (TASK-107; ADR-051): as redes do cenário, onde o guindaste
 * está, as medidas da carga e o contexto do içamento. Vai SEMPRE: sem rede, o backend ainda classifica
 * o içamento (75 % da capacidade, tandem, vento, solo e inclinação).
 */
export function buildEvaluationSite(inputs: SiteInputs): EvaluationSite {
  const { spec, load } = inputs
  return {
    powerLines: spec.powerLines ?? [],
    craneXM: spec.crane.x,
    craneZM: spec.crane.z,
    craneHeadingDeg: spec.crane.headingDeg,
    ...(load
      ? { loadLengthM: load.lengthM, loadWidthM: load.widthM, loadHeightM: load.heightM }
      : {}),
    ...(inputs.hookAttachM != null && inputs.hookAttachM > 0
      ? { hookAttachM: inputs.hookAttachM }
      : {}),
    tandem: inputs.tandem,
    loadOverOccupied: inputs.loadOverOccupied,
  }
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
      ...(scenarioExtras.obstacleConflicts && scenarioExtras.obstacleConflicts.length > 0
        ? { obstacleConflicts: scenarioExtras.obstacleConflicts }
        : {}),
      ...(scenarioExtras.site ? { site: scenarioExtras.site } : {}),
    },
    problem: null,
  }
}
