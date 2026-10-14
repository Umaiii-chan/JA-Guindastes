// Obstáculos em conflito com a operação (TASK-066; ADR-032), enviados à avaliação como
// `obstacle_conflicts`: os que estão dentro do raio de giro da carga e os que a colisão da TASK-053
// aponta (carga ou gancho encostando, lança ou cabo atravessando). Só pré-visualização: o que vale é o
// cálculo do backend (RN-008).

import type { CollisionState } from '../../domain/collision/collisions'
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
  for (const hit of collision.hits) if (hit.target.kind === 'obstacle') ids.add(hit.target.id)
  for (const alert of collision.alerts) ids.add(alert.obstacleId)
  if (workingRadiusM !== null && Number.isFinite(workingRadiusM)) {
    for (const obstacle of spec.obstacles) {
      const distance = Math.hypot(obstacle.centerX - spec.crane.x, obstacle.centerZ - spec.crane.z)
      if (distance - circumradiusM(obstacle) <= workingRadiusM) ids.add(obstacle.id)
    }
  }
  return [...ids].sort()
}
