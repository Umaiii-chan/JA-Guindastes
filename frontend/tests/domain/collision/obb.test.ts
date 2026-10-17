import { describe, expect, it } from 'vitest'

import {
  IDENTITY,
  IDENTITY_TRANSFORM,
  MAX_SAMPLE_POINTS,
  type Obb,
  obbFromFrame,
  obbOverlap,
  obbSurfacePoints,
  rotY,
  segmentIntersectsObb,
} from '../../../src/domain/collision/obb'

function unit(x: number, y: number, z: number, yawDeg = 0, half = 0.5): Obb {
  return obbFromFrame(
    { rot: rotY((yawDeg * Math.PI) / 180), pos: { x, y, z } },
    { x: 0, y: 0, z: 0 },
    { x: half, y: half, z: half },
  )
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

  it('arestas cruzadas em diagonal: só um eixo de produto vetorial separa', () => {
    // Duas barras a 45° em planos diferentes, quase se tocando pela aresta.
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
    expect(obbOverlap(a, b)).toBe(false)
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
    const zero = { x: 0, y: 0, z: 0 }
    const big = obbFromFrame(IDENTITY_TRANSFORM, zero, { x: 30, y: 30, z: 30 })
    expect(obbSurfacePoints(big).length).toBeLessThanOrEqual(MAX_SAMPLE_POINTS)
    // Uma viga de 20 m mantém o passo de 0,5 m ao longo dela (antes, 12 pontos: passo de 1,8 m).
    const beam = obbFromFrame(IDENTITY_TRANSFORM, zero, { x: 0.25, y: 0.25, z: 10 })
    const along = new Set(obbSurfacePoints(beam).map((p) => p.z.toFixed(6)))
    expect(along.size).toBe(41)
  })
})
