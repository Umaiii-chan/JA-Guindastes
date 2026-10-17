import { describe, expect, it } from 'vitest'

import {
  dot,
  IDENTITY,
  IDENTITY_TRANSFORM,
  type Mat3,
  MAX_SAMPLE_POINTS,
  mulMat,
  type Obb,
  obbFromFrame,
  obbOverlap,
  obbPenetration,
  obbSurfacePoints,
  rotX,
  rotY,
  segmentIntersectsObb,
  sub,
  type Vec3,
} from '../../../src/domain/collision/obb'

function unit(x: number, y: number, z: number, yawDeg = 0, half = 0.5): Obb {
  return obbFromFrame(
    { rot: rotY((yawDeg * Math.PI) / 180), pos: { x, y, z } },
    { x: 0, y: 0, z: 0 },
    { x: half, y: half, z: half },
  )
}

const ZERO: Vec3 = { x: 0, y: 0, z: 0 }

/** Rotação em torno de +Z, só para montar o caso das arestas cruzadas. */
function rotZ(rad: number): Mat3 {
  const c = Math.cos(rad)
  const s = Math.sin(rad)
  return [c, -s, 0, s, c, 0, 0, 0, 1]
}

/** Sobreposição das projeções das duas caixas no eixo unitário `axis` (≤ 0: o eixo separa). */
function overlapOn(a: Obb, b: Obb, axis: Vec3): number {
  const radius = (obb: Obb) =>
    obb.half.x * Math.abs(dot(obb.axes[0], axis)) +
    obb.half.y * Math.abs(dot(obb.axes[1], axis)) +
    obb.half.z * Math.abs(dot(obb.axes[2], axis))
  return radius(a) + radius(b) - Math.abs(dot(sub(b.center, a.center), axis))
}

/**
 * Caso só de aresta (TASK-091; F-30): A é o cubo de lado 2 na origem; B, uma barra 2 × 1 × 1 com uma
 * aresta ao longo de d = (1, −1, 0)/√2, virada para a aresta (1, 1, z) de A. As duas arestas se
 * cruzam em ângulo reto, a `gapM` uma da outra na direção n = (1, 1, 0)/√2 = Z × d: só esse eixo de
 * produto vetorial separa as caixas; nenhum dos 6 eixos de face separa.
 */
function edgeToEdge(gapM: number): { readonly a: Obb; readonly b: Obb } {
  const a = obbFromFrame(IDENTITY_TRANSFORM, ZERO, { x: 1, y: 1, z: 1 })
  // Eixos de B: x = d; y e z a 45° de n no plano (n, Z). A aresta de B mais perto de A fica a
  // 0,5·√2 do centro ao longo de n; a de A, a √2 da origem.
  const along = (Math.SQRT2 + gapM + 0.5 * Math.SQRT2) / Math.SQRT2
  const b = obbFromFrame(
    { rot: mulMat(rotZ(-Math.PI / 4), rotX(Math.PI / 4)), pos: { x: along, y: along, z: 0 } },
    ZERO,
    { x: 1, y: 0.5, z: 0.5 },
  )
  return { a, b }
}

describe('obbOverlap (SAT)', () => {
  it('caixas alinhadas: sobrepõem, encostam e separam', () => {
    expect(obbOverlap(unit(0, 0, 0), unit(0.9, 0, 0))).toBe(true)
    expect(obbOverlap(unit(0, 0, 0), unit(1, 0, 0))).toBe(false) // encosto não é colisão
    expect(obbOverlap(unit(0, 0, 0), unit(1.1, 0, 0))).toBe(false)
  })

  it('caixa girada 45° alcança mais longe pela diagonal', () => {
    expect(obbOverlap(unit(0, 0, 0, 45), unit(1.15, 0, 0))).toBe(true)
    expect(obbOverlap(unit(0, 0, 0), unit(1.15, 0, 0))).toBe(false)
  })

  it('barras finas cruzadas: separadas em Y não colidem, sobrepostas colidem', () => {
    const a = obbFromFrame(IDENTITY_TRANSFORM, { x: 0, y: 0, z: 0 }, { x: 2, y: 0.1, z: 0.1 })
    const bar = (y: number) =>
      obbFromFrame(
        { rot: IDENTITY, pos: { x: 0, y, z: 0 } },
        { x: 0, y: 0, z: 0 },
        { x: 0.1, y: 0.1, z: 2 },
      )
    expect(obbOverlap(a, bar(0.5))).toBe(false)
    expect(obbOverlap(a, bar(0.05))).toBe(true)
  })

  it('barras a 45° separadas na altura: o eixo de face Y já separa', () => {
    const a = obbFromFrame(
      { rot: rotY(Math.PI / 4), pos: { x: 0, y: 0, z: 0 } },
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0.05, z: 0.05 },
    )
    const b = obbFromFrame(
      { rot: rotY(-Math.PI / 4), pos: { x: 0, y: 0.2, z: 0 } },
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0.05, z: 0.05 },
    )
    expect(overlapOn(a, b, { x: 0, y: 1, z: 0 })).toBeLessThan(0)
    expect(obbOverlap(a, b)).toBe(false)
  })

  it('arestas cruzadas: só um eixo de produto vetorial separa (sem os 9 eixos de aresta, falharia)', () => {
    const { a, b } = edgeToEdge(0.1)
    // Nenhum dos 6 eixos de face separa as caixas...
    for (const axis of [...a.axes, ...b.axes]) expect(overlapOn(a, b, axis)).toBeGreaterThan(0.5)
    // ...só o eixo de aresta n = Z × d, com a folga de 0,1 m.
    const n = { x: Math.SQRT1_2, y: Math.SQRT1_2, z: 0 }
    expect(overlapOn(a, b, n)).toBeCloseTo(-0.1, 9)
    expect(obbOverlap(a, b)).toBe(false)
    expect(obbPenetration(a, b)).toBe(0)
  })

  it('arestas cruzadas que se tocam: colidem, e a profundidade é a do eixo de aresta', () => {
    const { a, b } = edgeToEdge(-0.1)
    expect(obbOverlap(a, b)).toBe(true)
    expect(obbPenetration(a, b)).toBeCloseTo(0.1, 9)
  })
})

describe('segmentIntersectsObb', () => {
  it('segmento que atravessa, que passa ao lado e que termina antes', () => {
    const box = unit(0, 0, 0)
    expect(segmentIntersectsObb({ x: -2, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }, box)).toBe(true)
    expect(segmentIntersectsObb({ x: -2, y: 2, z: 0 }, { x: 2, y: 2, z: 0 }, box)).toBe(false)
    expect(segmentIntersectsObb({ x: -2, y: 0, z: 0 }, { x: -1, y: 0, z: 0 }, box)).toBe(false)
  })

  it('respeita a rotação da caixa', () => {
    const box = unit(0, 0, 0, 45)
    expect(segmentIntersectsObb({ x: 0.6, y: 0, z: 0 }, { x: 0.6, y: 0, z: 0.1 }, box)).toBe(true)
    expect(segmentIntersectsObb({ x: 0.6, y: 0, z: 0.6 }, { x: 0.7, y: 0, z: 0.7 }, box)).toBe(
      false,
    )
  })
})

describe('obbSurfacePoints', () => {
  it('inclui os 8 cantos e fica sobre a superfície', () => {
    const points = obbSurfacePoints(unit(1, 2, 3, 30, 1))
    expect(points.length).toBeGreaterThan(8)
    const corners = points.filter(
      (p) => Math.abs(Math.hypot(p.x - 1, p.y - 2, p.z - 3) - Math.sqrt(3)) < 1e-9,
    )
    expect(corners.length).toBeGreaterThanOrEqual(8)
  })

  it('o teto é do total de pontos, não por aresta (TASK-091)', () => {
    const big = obbFromFrame(IDENTITY_TRANSFORM, ZERO, { x: 30, y: 30, z: 30 })
    expect(obbSurfacePoints(big).length).toBeLessThanOrEqual(MAX_SAMPLE_POINTS)
    // Uma viga de 20 m mantém o passo de 0,5 m ao longo dela (antes, 12 pontos: passo de 1,8 m).
    const beam = obbFromFrame(IDENTITY_TRANSFORM, ZERO, { x: 0.25, y: 0.25, z: 10 })
    const along = new Set(obbSurfacePoints(beam).map((p) => p.z.toFixed(6)))
    expect(along.size).toBe(41)
  })
})
