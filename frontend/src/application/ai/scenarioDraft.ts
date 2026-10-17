// Proposta de cenário da IA (TASK-076): o que vai para a prévia e o que "Aplicar" muda no simulador.
// Funções puras. A proposta já veio validada pelo backend; aqui só se traduz para a tela e para o
// formulário da carga.

import { guessCargoType } from '../../domain/cargo/cargoTypes'
import type { Obstacle } from '../../domain/environment/environment'
import { findLibraryObject } from '../../domain/environment/objectLibrary'
import type { LoadFormValues } from '../load/loadForm'
import { EMPTY_LOAD_FORM } from '../load/loadForm'
import type { AiLoadDraft, AiScenarioDraft } from './ports'

function n(value: number, digits = 2): string {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: digits })
}

/** Escala uniforme aceita para objetos da biblioteca vindos da IA (fora disso, o modelo some ou domina). */
const MIN_LIBRARY_SCALE = 0.5
const MAX_LIBRARY_SCALE = 3

/**
 * Objetos da biblioteca vindos da IA mantêm a proporção do modelo 3D. A IA escreve largura,
 * profundidade e altura soltas (ex.: carro 2 × 4,5 × 1,5 m), e a escala por eixo esticava o modelo.
 * Veículos e guindastes ficam no tamanho real; os demais recebem uma escala uniforme que preserva a
 * área da pegada pedida (independe de a IA ter trocado largura e profundidade).
 */
export function keepLibraryProportions(obstacle: Obstacle): Obstacle {
  if (obstacle.kind !== 'model') return obstacle
  const object = findLibraryObject(obstacle.modelId)
  if (!object) return obstacle
  // Contêiner ISO de 20/40 pés (`defaultSize`) tem a medida real fixa, como os veículos: a escala uniforme
  // do GLB (6 m) o deixaria alto demais.
  const { w, d, h } = object.defaultSize ?? object.baseSize
  const realSize =
    object.category === 'veiculo' ||
    object.category === 'guindaste' ||
    object.defaultSize !== undefined
  const footprint = (obstacle.widthM * obstacle.depthM) / (w * d)
  const raw = realSize || !(footprint > 0) ? 1 : Math.sqrt(footprint)
  const scale = Math.min(MAX_LIBRARY_SCALE, Math.max(MIN_LIBRARY_SCALE, raw))
  return { ...obstacle, widthM: w * scale, depthM: d * scale, heightM: h * scale }
}

/** Proposta com os objetos da biblioteca na proporção do modelo (ver `keepLibraryProportions`). */
export function withLibraryProportions(draft: AiScenarioDraft): AiScenarioDraft {
  return {
    ...draft,
    scenario: {
      ...draft.scenario,
      obstacles: draft.scenario.obstacles.map(keepLibraryProportions),
    },
  }
}

/** Carga proposta → campos do passo "Carga" (o centro de gravidade fica em branco). */
export function loadFormFromDraft(load: AiLoadDraft): LoadFormValues {
  return {
    ...EMPTY_LOAD_FORM,
    description: load.description,
    // O assistente só descreve a carga em texto: o tipo (e o modelo 3D) sai das palavras dela.
    cargoType: guessCargoType(load.description),
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
