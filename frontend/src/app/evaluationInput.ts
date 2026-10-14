// Monta o estado enviado ao backend a partir dos sliders (estado aplicado na cena) e dos campos da
// tela (TASK-032); desde a TASK-033, o id é o da configuração escolhida no catálogo. Só confere a forma que o backend exige (id não vazio, carga finita e >= 0); as
// faixas do guindaste são validadas no backend, com a ficha técnica (RN-008; ADR-013 C-5).

import type { EvaluationInput, OutriggerInput } from '../domain/evaluation/evaluation'
import type { CraneState } from '../three/crane/types'

export type EvaluationInputResult =
  | { readonly input: EvaluationInput; readonly problem: null }
  | { readonly input: null; readonly problem: string }

export function buildEvaluationInput(
  craneState: CraneState | null,
  configurationId: string,
  loadWeightText: string,
  outriggers?: OutriggerInput,
  accessoryIds: readonly string[] = [],
  /** Inclinação do terreno sob o guindaste (TASK-052); `undefined` com terreno plano. */
  groundSlopeDeg?: number,
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
    },
    problem: null,
  }
}
