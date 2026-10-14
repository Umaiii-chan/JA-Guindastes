// Área de operação no chão (TASK-055), com células FICTÍCIAS. ψ do ADR-013 C-2: 0° = +Z.

import { type Mesh } from 'three'
import { describe, expect, it } from 'vitest'

import type { OperatingArea } from '../../../src/domain/evaluation/operatingArea'
import { buildCraneScene } from '../../../src/three/scene/buildCraneScene'
import {
  buildOperatingAreaMeshData,
  OPERATING_AREA_COLORS,
  OPERATING_AREA_NAMES,
  OperatingAreaOverlay,
} from '../../../src/three/scene/OperatingAreaOverlay'

const AREA: OperatingArea = {
  configurationId: 'CFG-FICTICIA-AVALIACAO',
  boomLengthM: 20,
  loadWeightKg: 1500,
  comparedWeightKg: 1500,
  psiStepDeg: 10,
  radiusStepM: 2,
  maxRadiusM: 21.5,
  cells: [
    { psiDeg: 0, radiusM: 10, level: 'GREEN' },
    { psiDeg: 90, radiusM: 10, level: 'RED' },
  ],
}

describe('OperatingAreaOverlay', () => {
  it('começa vazia e invisível', () => {
    const overlay = new OperatingAreaOverlay()

    expect(overlay.root.name).toBe(OPERATING_AREA_NAMES.root)
    expect(overlay.root.visible).toBe(false)
    expect(overlay.cellCount).toBe(0)
  })

  it('desenha as células numa malha só e some quando recebe null', () => {
    const overlay = new OperatingAreaOverlay()

    expect(overlay.setArea(AREA)).toBe(true)
    expect(overlay.root.visible).toBe(true)
    expect(overlay.root.children).toHaveLength(1)
    expect(overlay.root.children[0].name).toBe(OPERATING_AREA_NAMES.cells)
    expect(overlay.cellCount).toBe(2)

    expect(overlay.setArea(AREA)).toBe(false)
    expect(overlay.setArea(null)).toBe(true)
    expect(overlay.root.visible).toBe(false)
    expect(overlay.root.children).toHaveLength(0)
  })

  it('cada célula vira 2 triângulos por fatia de 5°, pintados pelo nível', () => {
    const data = buildOperatingAreaMeshData(AREA)

    // 10° / 5° = 2 fatias × 2 triângulos × 2 células.
    expect(data.triangleCount).toBe(8)
    expect(data.positions).toHaveLength(8 * 9)
    const green = OPERATING_AREA_COLORS.GREEN
    const firstRed = [data.colors[4 * 9], data.colors[4 * 9 + 1], data.colors[4 * 9 + 2]]
    expect(firstRed[0]).toBeGreaterThan(firstRed[1])
    expect(firstRed[0]).toBeGreaterThan(firstRed[2])
    expect(green).not.toBe(OPERATING_AREA_COLORS.RED)
  })

  it('a célula do giro 0° fica à frente (+Z) e a de 90° à esquerda (+X)', () => {
    const data = buildOperatingAreaMeshData(AREA)
    const meanOf = (from: number, to: number, axis: 0 | 2) => {
      let total = 0
      for (let vertex = from; vertex < to; vertex += 1) total += data.positions[vertex * 3 + axis]
      return total / (to - from)
    }

    expect(meanOf(0, 12, 2)).toBeGreaterThan(8)
    expect(Math.abs(meanOf(0, 12, 0))).toBeLessThan(1)
    expect(meanOf(12, 24, 0)).toBeGreaterThan(8)
    expect(Math.abs(meanOf(12, 24, 2))).toBeLessThan(1)
  })

  it('o raio interno da primeira faixa não passa de zero', () => {
    const data = buildOperatingAreaMeshData({
      ...AREA,
      radiusStepM: 4,
      cells: [{ psiDeg: 0, radiusM: 2, level: 'GREEN' }],
    })

    for (let vertex = 0; vertex < data.positions.length / 3; vertex += 1) {
      expect(data.positions[vertex * 3 + 2]).toBeGreaterThanOrEqual(-1e-6)
    }
  })

  it('a cena montada traz a sobreposição e libera tudo no dispose', () => {
    const contents = buildCraneScene()
    const { operatingArea } = contents
    expect(contents.scene.children).toContain(operatingArea.root)

    operatingArea.setArea(AREA)
    const mesh = operatingArea.root.children[0] as Mesh
    let disposed = false
    mesh.geometry.addEventListener('dispose', () => {
      disposed = true
    })
    operatingArea.dispose()

    expect(disposed).toBe(true)
    expect(operatingArea.root.visible).toBe(false)
    operatingArea.dispose()
  })
})
