// Zona de giro destacada na cena do simulador (TASK-046; CA-6).
//
// A zona que vale é a do BACKEND (RN-008; na fronteira ±ε, a de menor capacidade). Ela só é usada
// quando o resultado corresponde ao estado atual: sem erro, sem problema na entrada e sem estado mais
// novo a caminho. Fora disso (ou se o backend não informou a zona), a cena mostra uma PRÉVIA pelo
// giro ψ da pré-visualização, só para desenho.

import { zoneAtRotation } from '../application/catalog/rotationZones'
import type { RotationZone } from '../domain/catalog/catalog'
import type { EvaluationResult } from '../domain/evaluation/evaluation'

export interface SceneZoneInput {
  readonly zones: readonly RotationZone[]
  /** ψ aplicado na cena (°), ou `null` antes de a cena montar. */
  readonly turretRotationDeg: number | null
  readonly result: EvaluationResult | null
  /** O resultado vale para o estado atual (sem erro, sem problema na entrada, nada pendente). */
  readonly resultIsCurrent: boolean
}

export function sceneRotationZoneCode({
  zones,
  turretRotationDeg,
  result,
  resultIsCurrent,
}: SceneZoneInput): string | null {
  if (zones.length === 0) return null
  const fromBackend = resultIsCurrent ? (result?.rotationZoneCode ?? null) : null
  if (fromBackend !== null && zones.some((zone) => zone.code === fromBackend)) return fromBackend
  return turretRotationDeg === null
    ? null
    : (zoneAtRotation(zones, turretRotationDeg)?.code ?? null)
}
