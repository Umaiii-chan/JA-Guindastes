import { describe, expect, it } from 'vitest'

import {
  PROVISIONAL_CRANE_GEOMETRY,
  PROVISIONAL_CRANE_LIMITS,
} from '../../../src/three/crane/provisionalCraneSpec'
import {
  arcPoints,
  arcSegments,
  boomDirection,
  computeReachRange,
  computeTurretSweep,
  formatRadiusLabel,
  pointAtRadius,
  RADIUS_LABEL_OFFSET_M,
  radiusLabelPosition,
} from '../../../src/three/scene/radiusGeometry'
import { expectClose } from '../../helpers/expectClose'

describe('radiusGeometry', () => {
  it('segue a direção da lança do ADR-013 C-2: ψ = 0 em +Z e ψ = 90° em +X', () => {
    expectClose(boomDirection(0).x, 0, 1e-12)
    expectClose(boomDirection(0).z, 1, 1e-12)
    expectClose(boomDirection(90).x, 1, 1e-12)
    expectClose(boomDirection(90).z, 0, 1e-12)
    const point = pointAtRadius(8, -90)
    expectClose(point.x, -8, 1e-12)
    expectClose(point.z, 0, 1e-12)
  })

  it('calcula o alcance mínimo e máximo pela fórmula (1) nas pontas das faixas (FICTÍCIOS da PoC)', () => {
    // a = −1,2 m; L de 12 a 22 m; θ de 0° a 80°. R_min = −1,2 + 12·cos 80° = 0,883778 (awk, 6 casas);
    // R_max = −1,2 + 22·cos 0° = 20,8.
    const reach = computeReachRange(PROVISIONAL_CRANE_LIMITS, PROVISIONAL_CRANE_GEOMETRY)
    expectClose(reach.minM, 0.883778, 1e-6)
    expectClose(reach.maxM, 20.8, 1e-9)
  })

  it('usa cos θ = 1 quando a faixa de θ passa por 0° e limita os raios a ≥ 0 (C-5)', () => {
    const reach = computeReachRange(
      { boomAngleDeg: { min: -10, max: 85 }, boomLengthM: { min: 10, max: 30 } },
      { boomPivotOffsetM: 0.5, boomPivotHeightM: 3 },
    )
    expectClose(reach.maxM, 30.5, 1e-9)
    expectClose(reach.minM, 0.5 + 10 * Math.cos((85 * Math.PI) / 180), 1e-9)

    const behind = computeReachRange(
      { boomAngleDeg: { min: 89, max: 90 }, boomLengthM: { min: 5, max: 6 } },
      { boomPivotOffsetM: -3, boomPivotHeightM: 3 },
    )
    expect(behind).toEqual({ minM: 0, maxM: 0 })
  })

  it('desenha a volta inteira quando o giro cobre 360°, e só o setor quando não cobre', () => {
    expect(computeTurretSweep({ min: -180, max: 180 })).toEqual({
      startDeg: 0,
      endDeg: 360,
      full: true,
    })
    expect(computeTurretSweep({ min: -60, max: 45 })).toEqual({
      startDeg: -60,
      endDeg: 45,
      full: false,
    })
  })

  it('gera arcos com todos os pontos no raio pedido, da primeira à última ponta', () => {
    const points = arcPoints(5, -90, 90, 12)
    expect(points).toHaveLength(13)
    for (const point of points) expectClose(Math.hypot(point.x, point.z), 5, 1e-9)
    expectClose(points[0].x, -5, 1e-9)
    expectClose(points[6].z, 5, 1e-9)
    expectClose(points[12].x, 5, 1e-9)

    const full = arcPoints(3, 0, 360, arcSegments(0, 360))
    expectClose(full[0].x, full[full.length - 1].x, 1e-9)
    expectClose(full[0].z, full[full.length - 1].z, 1e-9)
    expect(arcSegments(0, 360)).toBe(180)
    expect(arcSegments(0, 4)).toBe(8)
  })

  it('formata o rótulo em metros, com duas casas no formato pt-BR', () => {
    expect(formatRadiusLabel(8.629825)).toBe('R 8,63 m')
    expect(formatRadiusLabel(20.8)).toBe('R 20,80 m')
  })

  it('põe o rótulo além do anel, na direção da lança', () => {
    const position = radiusLabelPosition(10, 90)
    expectClose(position.x, 10 + RADIUS_LABEL_OFFSET_M, 1e-9)
    expectClose(position.z, 0, 1e-9)
  })
})
