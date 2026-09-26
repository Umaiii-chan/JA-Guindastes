import { expect } from 'vitest'

import type { Point3 } from '../../src/domain/geometry/operationalGeometry'

/** Ponto com coordenadas x, y e z, como `Point3` ou (convertido) um `Vector3` do Three.js. */
export type Xyz = readonly [number, number, number]

export function xyz(point: Point3): Xyz {
  return [point.xM, point.yM, point.zM]
}

/** Falha se |actual − expected| passar da tolerância absoluta explícita `toleranceM`. */
export function expectClose(
  actual: number,
  expected: number,
  toleranceM: number,
  label = '',
): void {
  expect(
    Math.abs(actual - expected),
    `${label} ${actual} ≠ ${expected} (tolerância ${toleranceM})`.trim(),
  ).toBeLessThanOrEqual(toleranceM)
}

/** Compara coordenada a coordenada, com a mesma tolerância absoluta. */
export function expectXyzClose(actual: Xyz, expected: Xyz, toleranceM: number, label = ''): void {
  const axes = ['x', 'y', 'z'] as const
  axes.forEach((axis, index) => {
    expectClose(actual[index], expected[index], toleranceM, `${label} ${axis}:`.trim())
  })
}
