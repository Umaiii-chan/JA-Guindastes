// Operações do cenário para o içamento com dois guindastes (TASK-074): adicionar um guindaste, e
// posicionar a carga entre os dois. Funções puras sobre o `ScenarioSpec`.

import {
  type CargoPlacement,
  type ExtraCrane,
  MAX_EXTRA_CRANES,
  type ScenarioSpec,
} from '../../domain/environment/environment'
import { localToWorld } from '../../domain/tandem/tandem'

/** Distância (m) em que o guindaste novo entra, à frente do principal e de frente para ele. */
export const DEFAULT_CRANE_SPACING_M = 24

const DEG = 180 / Math.PI

export function canAddExtraCrane(spec: ScenarioSpec): boolean {
  return (spec.cranes?.length ?? 0) < MAX_EXTRA_CRANES
}

function freshId(taken: readonly string[]): string {
  let n = taken.length + 1
  while (taken.includes(`extra-${n}`)) n += 1
  return `extra-${n}`
}

/**
 * Acrescenta um guindaste da configuração `configurationId`, a `DEFAULT_CRANE_SPACING_M` à frente do
 * principal e virado para ele (a pessoa o posiciona depois). Sem espaço (máximo de guindastes),
 * devolve `spec` sem mudar e `id: null`.
 */
export function addExtraCrane(
  spec: ScenarioSpec,
  configurationId: string,
): { readonly spec: ScenarioSpec; readonly id: string | null } {
  if (!canAddExtraCrane(spec)) return { spec, id: null }
  const existing = spec.cranes ?? []
  const id = freshId(existing.map((item) => item.id))
  const ahead = localToWorld(spec.crane, 0, DEFAULT_CRANE_SPACING_M)
  const crane: ExtraCrane = {
    id,
    configurationId,
    placement: {
      x: Math.round(ahead.x * 100) / 100,
      z: Math.round(ahead.z * 100) / 100,
      headingDeg: ((spec.crane.headingDeg + 180 + 180) % 360) - 180,
    },
  }
  return { spec: { ...spec, cranes: [...existing, crane] }, id }
}

/**
 * Carga entre o guindaste principal e o primeiro adicional, com o comprimento na direção que liga
 * os dois (os pontos de içamento ficam nas extremidades, um para cada guindaste).
 */
export function defaultCargoBetween(spec: ScenarioSpec): CargoPlacement {
  const first = spec.cranes?.[0]
  if (!first) return { x: spec.crane.x, z: spec.crane.z, rotationYDeg: 0 }
  const dx = first.placement.x - spec.crane.x
  const dz = first.placement.z - spec.crane.z
  return {
    x: Math.round(((spec.crane.x + first.placement.x) / 2) * 100) / 100,
    z: Math.round(((spec.crane.z + first.placement.z) / 2) * 100) / 100,
    // O +Z da carga aponta para (sin φ, cos φ): de um guindaste para o outro.
    rotationYDeg: Math.round(Math.atan2(dx, dz) * DEG * 100) / 100,
  }
}
