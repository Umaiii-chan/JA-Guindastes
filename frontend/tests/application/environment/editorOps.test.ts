// Editor 3D do ambiente (TASK-066): operações do cenário, solo, atitude do guindaste e conflitos.
// Dados FICTÍCIOS.

import { describe, expect, it } from 'vitest'

import {
  addObstacleAt,
  flattenAt,
  paintSoil,
  sculptAt,
  soilKindsUnderShoes,
  windSpeedForEvaluation,
  withWind,
} from '../../../src/application/environment/editorOps'
import { obstacleConflictIds } from '../../../src/application/environment/obstacleConflicts'
import { MAX_TERRAIN_FEATURES } from '../../../src/application/environment/scenarioEditing'
import { NO_COLLISION } from '../../../src/domain/collision/collisions'
import { craneAttitude } from '../../../src/domain/environment/craneAttitude'
import {
  EMPTY_SCENARIO,
  soilAt,
  terrainHeightAt,
  type ScenarioSpec,
} from '../../../src/domain/environment/environment'

describe('soilAt', () => {
  it('é compactado sem zonas e usa a zona mais recente que contém o ponto', () => {
    expect(soilAt(EMPTY_SCENARIO, 3, 3)).toBe('compacted')
    const spec: ScenarioSpec = {
      ...EMPTY_SCENARIO,
      soilZones: [
        { id: 'a', kind: 'rock', centerX: 0, centerZ: 0, radiusM: 10 },
        { id: 'b', kind: 'clay', centerX: 2, centerZ: 0, radiusM: 2 },
      ],
    }
    expect(soilAt(spec, 2, 0)).toBe('clay')
    expect(soilAt(spec, -6, 0)).toBe('rock')
    expect(soilAt(spec, 50, 0)).toBe('compacted')
  })
})

describe('terreno esculpido', () => {
  it('pinceladas no mesmo ponto somam na mesma elevação e o sinal inverte para depressão', () => {
    const once = sculptAt(EMPTY_SCENARIO, 10, 0, 4, 0.5)
    const twice = sculptAt(once, 10.2, 0, 4, 0.5)
    expect(twice.terrain.features).toHaveLength(1)
    expect(terrainHeightAt(twice.terrain, 10, 0)).toBeCloseTo(1, 3)
    const down = sculptAt(twice, 10, 0, 4, -1.5)
    expect(down.terrain.features[0]?.kind).toBe('pit')
    expect(terrainHeightAt(down.terrain, 10, 0)).toBeCloseTo(-0.5, 3)
  })

  it('não passa do limite de feições do backend', () => {
    let spec = EMPTY_SCENARIO
    for (let i = 0; i < MAX_TERRAIN_FEATURES + 5; i += 1) spec = sculptAt(spec, i * 20, 0, 2, 0.3)
    expect(spec.terrain.features).toHaveLength(MAX_TERRAIN_FEATURES)
  })

  it('aplainar leva o terreno ao nível pedido no centro e preserva fora do raio', () => {
    const raised = sculptAt(EMPTY_SCENARIO, 0, 0, 6, 2)
    const flat = flattenAt(raised, 0, 0, 6, 0)
    expect(terrainHeightAt(flat.terrain, 0, 0)).toBeCloseTo(0, 6)
    expect(terrainHeightAt(flat.terrain, 30, 0)).toBe(0)
    const higher = flattenAt(EMPTY_SCENARIO, 0, 0, 5, 1.5)
    expect(terrainHeightAt(higher.terrain, 1, 1)).toBeCloseTo(1.5, 6)
  })
})

describe('solo, obstáculos e vento', () => {
  it('pinta zonas, ignora repintura no mesmo ponto e lê o solo sob as quatro sapatas', () => {
    const painted = paintSoil(EMPTY_SCENARIO, 'loose_fill', 0, 0, 20)
    expect(paintSoil(painted, 'loose_fill', 0.5, 0, 20)).toBe(painted)
    expect(soilKindsUnderShoes(EMPTY_SCENARIO)).toBeUndefined()
    expect(soilKindsUnderShoes(painted)).toEqual([
      'loose_fill',
      'loose_fill',
      'loose_fill',
      'loose_fill',
    ])
  })

  it('adiciona obstáculo no ponto clicado com id novo', () => {
    const { spec, id } = addObstacleAt(EMPTY_SCENARIO, 'box', 7.456, -3)
    expect(id).not.toBeNull()
    expect(spec.obstacles[0]).toMatchObject({ id, centerX: 7.46, centerZ: -3, kind: 'box' })
  })

  it('vento 0 remove o vento enviado à avaliação', () => {
    const windy = withWind(EMPTY_SCENARIO, { speedMs: 8, directionDeg: 90 })
    expect(windSpeedForEvaluation(windy)).toBe(8)
    expect(windSpeedForEvaluation(withWind(windy, { speedMs: 0, directionDeg: 0 }))).toBeUndefined()
  })
})

describe('guindaste sobre o terreno', () => {
  const slope: ScenarioSpec = {
    ...EMPTY_SCENARIO,
    terrain: { slopeXPercent: 10, slopeZPercent: 0, features: [] },
    crane: { x: 20, z: 0, headingDeg: 0 },
  }

  it('assenta na altura sob o centro e inclina pelo plano das sapatas', () => {
    const attitude = craneAttitude(slope.terrain, slope.crane)
    expect(attitude.groundY).toBeCloseTo(2, 6)
    expect(attitude.terrainTiltDeg).toBeCloseTo(Math.atan(0.1) * (180 / Math.PI), 3)
    // O terreno sobe em +X: a normal do chassi inclina para -X.
    expect(attitude.normal.x).toBeLessThan(0)
    expect(attitude.normal.z).toBeCloseTo(0, 6)
  })

  it('os macacos compensam até o nivelamento e o resto continua inclinado', () => {
    const half = craneAttitude(slope.terrain, slope.crane, 2)
    expect(half.residualTiltDeg).toBeCloseTo(half.terrainTiltDeg - 2, 6)
    const full = craneAttitude(slope.terrain, slope.crane, 10)
    expect(full.residualTiltDeg).toBe(0)
    expect(full.normal.y).toBeCloseTo(1, 9)
  })

  it('terreno plano deixa o chassi nivelado', () => {
    expect(craneAttitude(EMPTY_SCENARIO.terrain, EMPTY_SCENARIO.crane).normal).toEqual({
      x: 0,
      y: 1,
      z: 0,
    })
  })
})

describe('obstáculos em conflito', () => {
  const spec: ScenarioSpec = {
    ...EMPTY_SCENARIO,
    obstacles: [
      {
        id: 'perto',
        label: 'Perto',
        kind: 'cylinder',
        centerX: 8,
        centerZ: 0,
        widthM: 2,
        depthM: 2,
        heightM: 3,
        rotationYDeg: 0,
      },
      {
        id: 'longe',
        label: 'Longe',
        kind: 'cylinder',
        centerX: 60,
        centerZ: 0,
        widthM: 2,
        depthM: 2,
        heightM: 3,
        rotationYDeg: 0,
      },
    ],
  }

  it('lista os que estão no raio de giro da carga e os apontados pela colisão', () => {
    expect(obstacleConflictIds(spec, 10, NO_COLLISION)).toEqual(['perto'])
    expect(obstacleConflictIds(spec, null, NO_COLLISION)).toEqual([])
    const alert = { segment: 'boom' as const, obstacleId: 'longe', label: 'Longe' }
    expect(obstacleConflictIds(spec, 10, { ...NO_COLLISION, alerts: [alert] })).toEqual([
      'longe',
      'perto',
    ])
  })
})
