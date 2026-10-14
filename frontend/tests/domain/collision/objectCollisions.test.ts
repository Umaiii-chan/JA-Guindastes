// Colisões com objetos da biblioteca (TASK-072; ADR-036): cada obstáculo `model` vira várias caixas,
// escaladas e giradas com o objeto. Dados FICTÍCIOS.

import { describe, expect, it } from 'vitest'

import {
  type CollisionInput,
  evaluateCollisions,
  obstacleObb,
  obstacleObbs,
} from '../../../src/domain/collision/collisions'
import { computeLoadBox } from '../../../src/domain/collision/loadBox'
import {
  EMPTY_SCENARIO,
  type Obstacle,
  type ScenarioSpec,
} from '../../../src/domain/environment/environment'
import { findLibraryObject, newModelObstacle } from '../../../src/domain/environment/objectLibrary'

const GEOMETRY = { boomPivotOffsetM: -1.56, boomPivotHeightM: 3.3 }
const LOAD = computeLoadBox({ lengthM: 4, widthM: 2, heightM: 1.5 }, 1.05)
const HOOK = { center: { x: 0, y: -0.55, z: 0 }, half: { x: 0.3, y: 0.5, z: 0.3 } }

function shed(overrides: Partial<Obstacle> = {}): Obstacle {
  return {
    ...newModelObstacle(findLibraryObject('barracao-aberto')!, 'barracao-1', 'Barracão FICTÍCIO'),
    centerX: 0,
    centerZ: 10,
    ...overrides,
  }
}

const scenarioWith = (...obstacles: Obstacle[]): ScenarioSpec => ({ ...EMPTY_SCENARIO, obstacles })

function input(
  state: CollisionInput['state'],
  scenario: ScenarioSpec,
  load: CollisionInput['load'] = LOAD,
): CollisionInput {
  return { state, geometryParameters: GEOMETRY, scenario, body: null, load, hook: HOOK }
}

describe('obstacleObbs', () => {
  it('caixa e cilindro continuam sendo uma só', () => {
    const box: Obstacle = {
      id: 'c',
      label: 'Caixa',
      kind: 'box',
      centerX: 0,
      centerZ: 0,
      widthM: 2,
      depthM: 2,
      heightM: 2,
      rotationYDeg: 0,
    }
    expect(obstacleObbs(box, EMPTY_SCENARIO.terrain)).toEqual([
      obstacleObb(box, EMPTY_SCENARIO.terrain),
    ])
  })

  it('o barracão vira paredes, verga e telhado; gira e sobe com o terreno', () => {
    const terrain = { slopeXPercent: 0, slopeZPercent: 0, features: [] }
    const boxes = obstacleObbs(shed(), terrain)
    expect(boxes.length).toBeGreaterThan(6)
    const unrotatedFront = boxes.find((obb) => Math.abs(obb.center.z - (10 + 8.8)) < 1e-6)
    expect(unrotatedFront).toBeDefined()

    // Girado 180°, a frente (a porta) passa a olhar para -Z, para o guindaste.
    const turned = obstacleObbs(shed({ rotationYDeg: 180 }), terrain)
    expect(turned.find((obb) => Math.abs(obb.center.z - (10 - 8.8)) < 1e-6)).toBeDefined()

    // Sobre um morro, a base acompanha o terreno no centro.
    const hill = {
      slopeXPercent: 0,
      slopeZPercent: 0,
      features: [
        { id: 'm', kind: 'plateau' as const, centerX: 0, centerZ: 10, radiusM: 30, heightM: 2 },
      ],
    }
    const raised = obstacleObbs(shed(), hill)
    expect(raised[0]!.center.y - boxes[0]!.center.y).toBeCloseTo(2)
  })

  it('escala o tamanho do obstáculo junto com as caixas', () => {
    const terrain = EMPTY_SCENARIO.terrain
    const normal = obstacleObbs(shed(), terrain)
    const wide = obstacleObbs(shed({ widthM: 28 }), terrain)
    expect(wide[0]!.half.x).toBeCloseTo(normal[0]!.half.x * 2)
    expect(wide[0]!.half.z).toBeCloseTo(normal[0]!.half.z)
  })

  it('um modelId desconhecido volta à caixa que o envolve', () => {
    const unknown = shed({ modelId: 'fora-da-biblioteca', widthM: 3, depthM: 4, heightM: 5 })
    const boxes = obstacleObbs(unknown, EMPTY_SCENARIO.terrain)
    expect(boxes).toHaveLength(1)
    expect(boxes[0]!.half).toEqual({ x: 1.5, y: 2.5, z: 2 })
  })
})

describe('a carga e o barracão', () => {
  // Guindaste na origem, barracão com a porta para o guindaste (giro 180°), centro em z = 22:
  // a porta fica em z = 13.2. Lança quase deitada (5°), 18 m: a ponta fica dentro do barracão.
  const scenario = scenarioWith(shed({ centerZ: 22, rotationYDeg: 180 }))
  const inside = { turretRotationDeg: 0, boomAngleDeg: 8, boomLengthM: 20, cableLengthM: 0.5 }

  it('a carga entra pela porta e a lança passa por ela: nada colide nem alerta', () => {
    const report = evaluateCollisions(input(inside, scenario))
    expect(report.hits).toEqual([])
    expect(report.alerts).toEqual([])
    expect(report.penetrationM).toBe(0)
  })

  it('de lado, a carga bate na parede lateral, com o barracão no aviso', () => {
    const side = { ...inside, turretRotationDeg: 28 }
    const report = evaluateCollisions(input(side, scenario))
    const hit = report.hits.find((item) => item.target.kind === 'obstacle')
    expect(hit?.target).toMatchObject({ kind: 'obstacle', id: 'barracao-1' })
  })

  it('o teto barra a carga que desce de cima', () => {
    const overRoof = { turretRotationDeg: 0, boomAngleDeg: 40, boomLengthM: 30, cableLengthM: 14.5 }
    const report = evaluateCollisions(input(overRoof, scenario))
    expect(report.hits.some((item) => item.target.kind === 'obstacle')).toBe(true)
  })

  it('cabo e lança avisam uma vez por objeto, mesmo com várias caixas', () => {
    // Lança a 20° com 25 m: a ponta fica dentro do forro do barracão e a lança o atravessa.
    const report = evaluateCollisions(
      input(
        { turretRotationDeg: 0, boomAngleDeg: 20, boomLengthM: 24, cableLengthM: 6 },
        scenario,
        null,
      ),
    )
    const boomAlerts = report.alerts.filter((alert) => alert.segment === 'boom')
    expect(boomAlerts).toHaveLength(1)
    expect(boomAlerts[0]).toMatchObject({ obstacleId: 'barracao-1' })
  })
})
