// Proposta de cenário da IA (TASK-076): o que vai para a prévia e o que "Aplicar" muda no simulador.
// Funções puras. A proposta já veio validada pelo backend; aqui só se traduz para a tela e para o
// formulário da carga.

import type { LoadFormValues } from '../load/loadForm'
import { EMPTY_LOAD_FORM } from '../load/loadForm'
import type { AiLoadDraft, AiScenarioDraft } from './ports'

function n(value: number, digits = 2): string {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: digits })
}

/** Carga proposta → campos do passo "Carga" (o centro de gravidade fica em branco). */
export function loadFormFromDraft(load: AiLoadDraft): LoadFormValues {
  return {
    ...EMPTY_LOAD_FORM,
    description: load.description,
    weightKg: String(load.weightKg),
    lengthM: String(load.lengthM),
    widthM: String(load.widthM),
    heightM: String(load.heightM),
  }
}

/** Linhas da prévia, em pt-BR, só com o que a proposta realmente traz. */
export function describeDraft(draft: AiScenarioDraft): readonly string[] {
  const { load, scenario } = draft
  const lines = [
    `Carga: ${load.description}, ${n(load.weightKg, 0)} kg, ${n(load.lengthM)} × ${n(load.widthM)} × ${n(load.heightM)} m`,
    `Guindaste em (${n(scenario.crane.x, 1)} m, ${n(scenario.crane.z, 1)} m)`,
  ]
  if (scenario.cargo) {
    lines.push(`Retirada da carga em (${n(scenario.cargo.x, 1)} m, ${n(scenario.cargo.z, 1)} m)`)
  }
  if (scenario.delivery) {
    lines.push(
      `Entrega em (${n(scenario.delivery.x, 1)} m, ${n(scenario.delivery.z, 1)} m), raio de ${n(scenario.delivery.radiusM, 1)} m`,
    )
  }
  if (scenario.obstacles.length > 0) {
    const labels = scenario.obstacles.map((obstacle) => obstacle.label).join(', ')
    lines.push(
      `${scenario.obstacles.length} ${scenario.obstacles.length === 1 ? 'obstáculo' : 'obstáculos'}: ${labels}`,
    )
  }
  const { slopeXPercent, slopeZPercent } = scenario.terrain
  if (slopeXPercent !== 0 || slopeZPercent !== 0) {
    lines.push(`Terreno inclinado (${n(slopeXPercent, 1)} % em X, ${n(slopeZPercent, 1)} % em Z)`)
  }
  if (scenario.wind) lines.push(`Vento de ${n(scenario.wind.speedMs, 1)} m/s`)
  const soils = scenario.soilZones ?? []
  if (soils.length > 0)
    lines.push(`${soils.length} ${soils.length === 1 ? 'zona' : 'zonas'} de solo`)
  return lines
}
