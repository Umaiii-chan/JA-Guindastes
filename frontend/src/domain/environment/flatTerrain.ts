// Terreno sem relevo (TASK-052): sem inclinação e sem feições, a cena mantém o plano de sempre.

import type { TerrainSpec } from './environment'

export function isFlatTerrain(terrain: TerrainSpec): boolean {
  return terrain.slopeXPercent === 0 && terrain.slopeZPercent === 0 && terrain.features.length === 0
}
