// Operações do cenário para o içamento com dois guindastes (TASK-074): adicionar um guindaste, e
// posicionar a carga entre os dois. Funções puras sobre o `ScenarioSpec`.

import {
  type CargoPlacement,
  type ExtraCrane,
  MAX_EXTRA_CRANES,
  type ScenarioSpec,
} from '../../domain/environment/environment'
import { localToWorld } from '../../domain/tandem/tandem'

/**
 * Distância (m) em que o guindaste novo entra, ao lado do principal (à direita do chassi), com o
 * mesmo rumo: os dois trabalham lado a lado, com as lanças paralelas, que é o arranjo comum do
 * içamento em tandem. Deixa uma folga entre os chassis (que têm uns 6 m de largura com as patolas).
 */
export const DEFAULT_CRANE_SPACING_M = 8

/** Distância (m) da carga à frente da linha dos dois guindastes (raio de trabalho de ~10 m). */
export const DEFAULT_CARGO_DISTANCE_M = 10.5

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
 * Acrescenta um guindaste da configuração `configurationId`, a `DEFAULT_CRANE_SPACING_M` ao lado do
 * principal e com o mesmo rumo (a pessoa o posiciona depois). Sem espaço (máximo de guindastes),
 * devolve `spec` sem mudar e `id: null`.
 */
export function addExtraCrane(
  spec: ScenarioSpec,
  configurationId: string,
): { readonly spec: ScenarioSpec; readonly id: string | null } {
  if (!canAddExtraCrane(spec)) return { spec, id: null }
  const existing = spec.cranes ?? []
  const id = freshId(existing.map((item) => item.id))
  const beside = localToWorld(spec.crane, DEFAULT_CRANE_SPACING_M, 0)
  const crane: ExtraCrane = {
    id,
    configurationId,
    placement: {
      x: Math.round(beside.x * 100) / 100,
      z: Math.round(beside.z * 100) / 100,
      headingDeg: spec.crane.headingDeg,
    },
  }
  return { spec: { ...spec, cranes: [...existing, crane] }, id }
}

/**
 * Carga à frente dos dois guindastes, no meio entre eles, com o comprimento na direção da linha que
 * os liga (os pontos de içamento ficam nas extremidades, um para cada guindaste).
 */
export function defaultCargoBetween(spec: ScenarioSpec): CargoPlacement {
  const first = spec.cranes?.[0]
  if (!first) {
    const ahead = localToWorld(spec.crane, 0, DEFAULT_CARGO_DISTANCE_M)
    return { x: round2(ahead.x), z: round2(ahead.z), rotationYDeg: 0 }
  }
  const dx = first.placement.x - spec.crane.x
  const dz = first.placement.z - spec.crane.z
  const middle = {
    x: (spec.crane.x + first.placement.x) / 2,
    z: (spec.crane.z + first.placement.z) / 2,
  }
  // Para a frente do guindaste principal, a partir do meio da linha.
  const heading = (spec.crane.headingDeg * Math.PI) / 180
  const forward = { x: Math.sin(heading), z: Math.cos(heading) }
  return {
    x: round2(middle.x + forward.x * DEFAULT_CARGO_DISTANCE_M),
    z: round2(middle.z + forward.z * DEFAULT_CARGO_DISTANCE_M),
    // O +Z da carga aponta para (sin φ, cos φ): de um guindaste para o outro.
    rotationYDeg: round2(Math.atan2(dx, dz) * DEG),
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}
