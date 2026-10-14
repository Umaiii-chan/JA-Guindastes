// Aplicar uma recomendação do planejamento ao cenário (TASK-075 com TASK-074): o Guindaste 1 vai para
// a posição recomendada e, no tandem, o Guindaste 2 entra (ou é trocado) com a configuração e a
// posição do segundo guindaste da recomendação. Função pura sobre o `ScenarioSpec`.

import type { ExtraCrane, ScenarioSpec } from '../../domain/environment/environment'
import type { PlanRecommendation } from '../../domain/planning/planning'

/** Id do segundo guindaste quando o cenário ainda não tem nenhum adicional. */
export const PLANNED_SECOND_CRANE_ID = 'extra-1'

export function applyRecommendationToScenario(
  spec: ScenarioSpec,
  recommendation: PlanRecommendation,
): ScenarioSpec {
  const first = recommendation.placements[0]
  if (!first) return spec
  const next: ScenarioSpec = {
    ...spec,
    crane: { x: first.x, z: first.z, headingDeg: first.headingDeg },
  }
  const second = recommendation.placements[1]
  const secondConfigurationId =
    recommendation.details[1]?.configurationId ?? recommendation.configurationIds[1]
  if (recommendation.kind !== 'tandem' || !second || !secondConfigurationId) return next
  const others = spec.cranes ?? []
  const planned: ExtraCrane = {
    id: others[0]?.id ?? PLANNED_SECOND_CRANE_ID,
    configurationId: secondConfigurationId,
    placement: { x: second.x, z: second.z, headingDeg: second.headingDeg },
  }
  return { ...next, cranes: [planned, ...others.slice(1)] }
}
