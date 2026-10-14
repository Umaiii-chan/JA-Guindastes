// Obstáculos em conflito com a operação (TASK-066; ADR-032), enviados à avaliação como
// `obstacle_conflicts`: os que estão dentro do raio de giro da carga e os que a colisão da TASK-053
// aponta (carga ou gancho encostando, lança ou cabo atravessando). Só pré-visualização: o que vale é o
// cálculo do backend (RN-008).

import { type CollisionState, GROUND_CARGO_ID } from '../../domain/collision/collisions'
import type { Obstacle, ScenarioSpec } from '../../domain/environment/environment'

/** Raio do menor círculo, centrado no obstáculo, que o envolve (m). */
function circumradiusM(obstacle: Obstacle): number {
  if (obstacle.kind === 'cylinder') return obstacle.widthM / 2
  return Math.hypot(obstacle.widthM, obstacle.depthM) / 2
}

/**
 * Ids dos obstáculos em conflito, sem repetição e em ordem alfabética. `workingRadiusM` é o raio da
 * carga em relação ao eixo de giro; `null` (sem geometria válida) só usa a colisão.
 */
export function obstacleConflictIds(
  spec: ScenarioSpec,
  workingRadiusM: number | null,
  collision: CollisionState,
): readonly string[] {
  const ids = new Set<string>()
  // A carga apoiada no chão (TASK-073) não é um obstáculo do cenário: não vai à avaliação.
  for (const hit of collision.hits) {
    if (hit.target.kind === 'obstacle' && hit.target.id !== GROUND_CARGO_ID) ids.add(hit.target.id)
  }
  for (const alert of collision.alerts) {
    if (alert.obstacleId !== GROUND_CARGO_ID) ids.add(alert.obstacleId)
  }
  if (workingRadiusM !== null && Number.isFinite(workingRadiusM)) {
    for (const obstacle of spec.obstacles) {
      const distance = Math.hypot(obstacle.centerX - spec.crane.x, obstacle.centerZ - spec.crane.z)
      if (distance - circumradiusM(obstacle) <= workingRadiusM) ids.add(obstacle.id)
    }
  }
  return [...ids].sort()
}

/** Tamanho máximo de cada item de `obstacle_conflicts` no contrato do backend. */
const CONFLICT_TEXT_MAX = 64

/**
 * Rótulos legíveis dos obstáculos em conflito, para o alerta do backend falar a língua da tela
 * ("Árvore (carvalho), Caminhão") em vez dos ids internos. Sem rótulo, fica o id; repetidos saem.
 */
export function obstacleConflictLabels(
  spec: ScenarioSpec,
  ids: readonly string[],
): readonly string[] {
  const labels = new Set<string>()
  for (const id of ids) {
    const label = spec.obstacles.find((obstacle) => obstacle.id === id)?.label.trim() || id
    labels.add(label.slice(0, CONFLICT_TEXT_MAX))
  }
  return [...labels]
}
