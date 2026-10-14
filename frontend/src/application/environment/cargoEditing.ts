// Operações do editor para a carga e o ponto de entrega (TASK-073; ADR-035): funções puras sobre o
// `ScenarioSpec`. Cada um existe no máximo uma vez no cenário.

import {
  type CargoPlacement,
  DEFAULT_DELIVERY_RADIUS_M,
  type DeliveryPoint,
  type ScenarioSpec,
} from '../../domain/environment/environment'

/** Faixa do raio de tolerância do ponto de entrega (m). */
export const DELIVERY_RADIUS_RANGE = { min: 0.5, max: 30 } as const

const round2 = (value: number): number => Math.round(value * 100) / 100

/** Raio dentro da faixa e com duas casas. */
export function clampDeliveryRadius(radiusM: number): number {
  if (!Number.isFinite(radiusM)) return DEFAULT_DELIVERY_RADIUS_M
  return round2(Math.min(DELIVERY_RADIUS_RANGE.max, Math.max(DELIVERY_RADIUS_RANGE.min, radiusM)))
}

/** Põe a carga em (x, z) (mantém o giro de antes, se já havia). */
export function placeCargoAt(spec: ScenarioSpec, x: number, z: number): ScenarioSpec {
  const cargo: CargoPlacement = {
    x: round2(x),
    z: round2(z),
    rotationYDeg: spec.cargo?.rotationYDeg ?? 0,
  }
  return { ...spec, cargo }
}

/** Põe o ponto de entrega em (x, z) (mantém o raio e o giro de antes, se já havia). */
export function placeDeliveryAt(spec: ScenarioSpec, x: number, z: number): ScenarioSpec {
  const delivery: DeliveryPoint = {
    x: round2(x),
    z: round2(z),
    rotationYDeg: spec.delivery?.rotationYDeg ?? 0,
    radiusM: spec.delivery?.radiusM ?? DEFAULT_DELIVERY_RADIUS_M,
  }
  return { ...spec, delivery }
}

export function removeCargo(spec: ScenarioSpec): ScenarioSpec {
  const { cargo: _removed, ...rest } = spec
  void _removed
  return rest
}

export function removeDelivery(spec: ScenarioSpec): ScenarioSpec {
  const { delivery: _removed, ...rest } = spec
  void _removed
  return rest
}
