// Terreno sob a carga (TASK-091; F-17 da auditoria; ADR-028 § 2): a face de baixo com passo fixo de
// 0,5 m, teto no total de pontos e os picos analíticos das feições. Terrenos e medidas FICTÍCIOS.

import { describe, expect, it } from 'vitest'

import { obbTerrainDepth } from '../../../src/domain/collision/collisions'
import {
  IDENTITY,
  MAX_SAMPLE_POINTS,
  obbFromFrame,
  rotX,
  rotY,
} from '../../../src/domain/collision/obb'
import {
  groundGrid,
  obbBottomFace,
  TERRAIN_SAMPLE_STEP_M,
  terrainPeaks,
} from '../../../src/domain/collision/terrainSampling'
import {
  type TerrainFeature,
  type TerrainSpec,
  terrainHeightAt,
} from '../../../src/domain/environment/environment'

const terrainWith = (...features: TerrainFeature[]): TerrainSpec => ({
  slopeXPercent: 0,
  slopeZPercent: 0,
  features,
})

/** Viga FICTÍCIA de 20 m ao longo de Z, 0,5 × 0,5 m de seção, com a base em `bottomY`. */
function beam(bottomY: number, yawDeg = 0) {
  return obbFromFrame(
    { rot: rotY((yawDeg * Math.PI) / 180), pos: { x: 0, y: bottomY + 0.25, z: 0 } },
    { x: 0, y: 0, z: 0 },
    { x: 0.25, y: 0.25, z: 10 },
  )
}

/** Referência: penetração por uma grade bem fina (2 cm) sob a pegada da viga sem giro. */
function fineDepth(terrain: TerrainSpec, bottomY: number): number {
  let depth = 0
  for (let x = -0.25; x <= 0.25 + 1e-9; x += 0.02) {
    for (let z = -10; z <= 10 + 1e-9; z += 0.02) {
      depth = Math.max(depth, terrainHeightAt(terrain, x, z) - bottomY)
    }
  }
  return depth
}

describe('obbTerrainDepth — carga comprida sobre feição estreita (F-17)', () => {
  it('cenário da auditoria: monte de raio 1 m e 2 m de altura sob a viga de 20 m, base a 0,5 m', () => {
    const mound = terrainWith({
      id: 'monte',
      kind: 'mound',
      centerX: 0,
      centerZ: 0,
      radiusM: 1,
      heightM: 2,
    })
    // Antes: 12 pontos por aresta (passo de 1,8 m) e o monte passava entre duas amostras (0 m).
    expect(obbTerrainDepth(beam(0.5), mound)).toBeCloseTo(1.5, 6)
  })

  it('monte mais estreito que o passo, entre duas amostras da grade: o pico analítico pega', () => {
    // Raio de 0,2 m com o centro em z = 0,25 (entre as amostras z = 0 e z = 0,5) e fora do eixo.
    const spike = terrainWith({
      id: 'pico',
      kind: 'mound',
      centerX: 0.1,
      centerZ: 0.25,
      radiusM: 0.2,
      heightM: 2,
    })
    expect(obbTerrainDepth(beam(0.5), spike)).toBeCloseTo(1.5, 6)
    // Nada que uma grade de 2 cm vê fica de fora.
    expect(obbTerrainDepth(beam(0.5), spike)).toBeGreaterThanOrEqual(fineDepth(spike, 0.5) - 1e-9)
  })

  it('o pico de um monte fora da pegada vale no ponto da viga mais perto dele', () => {
    // Centro a 0,45 m do eixo da viga (0,2 m além da borda), raio de 0,6 m.
    const side = terrainWith({
      id: 'lado',
      kind: 'mound',
      centerX: 0.45,
      centerZ: 3.25,
      radiusM: 0.6,
      heightM: 2,
    })
    const expected = terrainHeightAt(side, 0.25, 3.25) - 0.5
    expect(expected).toBeGreaterThan(0)
    expect(obbTerrainDepth(beam(0.5), side)).toBeCloseTo(expected, 6)
  })

  it('platô estreito também entra pelo pico', () => {
    const plateau = terrainWith({
      id: 'plato',
      kind: 'plateau',
      centerX: 0,
      centerZ: -4.75,
      radiusM: 0.3,
      heightM: 1,
    })
    expect(obbTerrainDepth(beam(0.2), plateau)).toBeCloseTo(0.8, 6)
  })

  it('rampa estreita atravessando a viga: a ponta alta dentro da pegada', () => {
    // Sobe no sentido +X (0°) de 0 a 2 m em 2 m de comprimento; só 0,2 m de largura, em z = 0,25
    // (entre as amostras). Dentro da viga (|x| ≤ 0,25), o ponto mais alto fica em x = 0,25: 1,25 m.
    const ramp = terrainWith({
      id: 'rampa',
      kind: 'ramp',
      centerX: 0,
      centerZ: 0.25,
      radiusM: 1,
      heightM: 2,
      directionDeg: 0,
      widthM: 0.2,
    })
    expect(obbTerrainDepth(beam(0.5), ramp)).toBeCloseTo(0.75, 4)
  })

  it('rampa cuja borda alta cai dentro da pegada', () => {
    // Viga girada 90°: fica ao longo de X; a rampa sobe para −Z (90°) e termina em z = 0,2.
    const ramp = terrainWith({
      id: 'rampa',
      kind: 'ramp',
      centerX: 3.1,
      centerZ: 1.2,
      radiusM: 1,
      heightM: 1.5,
      directionDeg: 90,
      widthM: 0.3,
    })
    expect(obbTerrainDepth(beam(0, 90), ramp)).toBeCloseTo(1.5, 4)
  })

  it('depressão não tem pico e o chão plano não acusa nada', () => {
    const pit = terrainWith({
      id: 'buraco',
      kind: 'pit',
      centerX: 0,
      centerZ: 0,
      radiusM: 1,
      heightM: 2,
    })
    const face = obbBottomFace(beam(0.5))!
    expect(terrainPeaks(pit, face.rect)).toEqual([])
    expect(obbTerrainDepth(beam(0.5), pit)).toBe(0)
    expect(obbTerrainDepth(beam(0), terrainWith())).toBe(0)
  })
})

describe('amostragem da face de baixo', () => {
  it('passo fixo de 0,5 m: a viga de 20 m tem 41 pontos ao longo dela', () => {
    const face = obbBottomFace(beam(0))!
    expect(face.bottomY).toBeCloseTo(0)
    const points = groundGrid(face.rect)
    expect(TERRAIN_SAMPLE_STEP_M).toBe(0.5)
    expect(points).toHaveLength(2 * 41)
    expect(new Set(points.map((point) => point.z.toFixed(6))).size).toBe(41)
  })

  it('o teto vale para o total de pontos, e os cantos continuam na grade', () => {
    const huge = obbFromFrame(
      { rot: IDENTITY, pos: { x: 0, y: 1, z: 0 } },
      { x: 0, y: 0, z: 0 },
      { x: 40, y: 1, z: 40 },
    )
    const points = groundGrid(obbBottomFace(huge)!.rect)
    expect(points.length).toBeLessThanOrEqual(MAX_SAMPLE_POINTS)
    expect(points.length).toBeGreaterThan(MAX_SAMPLE_POINTS / 2)
    for (const [x, z] of [
      [-40, -40],
      [40, -40],
      [40, 40],
      [-40, 40],
    ]) {
      expect(points.some((p) => Math.abs(p.x - x!) < 1e-9 && Math.abs(p.z - z!) < 1e-9)).toBe(true)
    }
  })

  it('caixa inclinada volta à superfície inteira e ainda vê o terreno', () => {
    const tilted = obbFromFrame(
      { rot: rotX(Math.PI / 6), pos: { x: 0, y: 0.3, z: 0 } },
      { x: 0, y: 0, z: 0 },
      { x: 0.5, y: 0.5, z: 2 },
    )
    expect(obbBottomFace(tilted)).toBeNull()
    expect(obbTerrainDepth(tilted, terrainWith())).toBeGreaterThan(0.5)
  })
})
