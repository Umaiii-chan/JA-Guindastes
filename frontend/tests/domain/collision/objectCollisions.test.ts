// Colisões com objetos da biblioteca (TASK-072; ADR-036): cada obstáculo `model` vira várias caixas,
// escaladas e giradas com o objeto. Dados FICTÍCIOS.

import { Group, MathUtils, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import {
  type CollisionInput,
  evaluateCollisions,
  obstacleObb,
  obstacleObbs,
} from '../../../src/domain/collision/collisions'
import { computeLoadBox } from '../../../src/domain/collision/loadBox'
import type { Obb } from '../../../src/domain/collision/obb'
import {
  EMPTY_SCENARIO,
  type Obstacle,
  type ScenarioSpec,
} from '../../../src/domain/environment/environment'
import {
  findLibraryObject,
  newModelObstacle,
  scaledCollisionBoxes,
} from '../../../src/domain/environment/objectLibrary'

/**
 * O grupo do obstáculo como a cena o monta (`ObstacleMeshes`): na posição do centro, com
 * `rotation.y` = `rotationYDeg`. Serve de referência para o sinal do giro das caixas de colisão.
 */
function sceneGroup(obstacle: Obstacle, baseY = 0): Group {
  const group = new Group()
  group.position.set(obstacle.centerX, baseY, obstacle.centerZ)
  group.rotation.y = MathUtils.degToRad(obstacle.rotationYDeg)
  group.updateMatrixWorld(true)
  return group
}

function expectAxesLikeScene(obb: Obb, group: Group): void {
  const sceneAxes = [new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 0, 1)].map((axis) =>
    axis.applyQuaternion(group.quaternion),
  )
  obb.axes.forEach((axis, index) => {
    expect(axis.x).toBeCloseTo(sceneAxes[index]!.x, 9)
    expect(axis.y).toBeCloseTo(sceneAxes[index]!.y, 9)
    expect(axis.z).toBeCloseTo(sceneAxes[index]!.z, 9)
  })
}

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

  it('o galpão vira o arco e o fundo em caixas; gira e sobe com o terreno', () => {
    const terrain = { slopeXPercent: 0, slopeZPercent: 0, features: [] }
    const boxes = obstacleObbs(shed(), terrain)
    expect(boxes.length).toBeGreaterThan(20)
    const unrotatedBack = boxes.find((obb) => Math.abs(obb.center.z - (10 - 11.61)) < 1e-6)
    expect(unrotatedBack).toBeDefined()

    // Girado 180°, a frente (a abertura) passa a olhar para -Z, para o guindaste, e o fundo vai para +Z.
    const turned = obstacleObbs(shed({ rotationYDeg: 180 }), terrain)
    expect(turned.find((obb) => Math.abs(obb.center.z - (10 + 11.61)) < 1e-6)).toBeDefined()

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

  it('o sinal do giro é o da cena: com 90°, o fundo do galpão vai para −X (TASK-091; F-30)', () => {
    // 0° e 180° dão o mesmo resultado com qualquer sinal; 90° não. Como `rotation.y` do Three.js,
    // +90° leva +Z para +X, então as faixas do fundo (z local = −11,61) vão para x = −11,61.
    const terrain = EMPTY_SCENARIO.terrain
    const quarter = obstacleObbs(shed({ rotationYDeg: 90 }), terrain)
    const atX = (x: number) => quarter.filter((obb) => Math.abs(obb.center.x - x) < 1e-6)
    expect(atX(-11.61).length).toBeGreaterThan(0)
    expect(atX(11.61)).toEqual([])
  })

  it('cada caixa do objeto fica onde a cena desenha o modelo, num giro qualquer (30°)', () => {
    const obstacle = shed({ centerX: 4, centerZ: -7, rotationYDeg: 30 })
    const group = sceneGroup(obstacle)
    const object = findLibraryObject('barracao-aberto')!
    const boxes = scaledCollisionBoxes(obstacle, object)
    const obbs = obstacleObbs(obstacle, EMPTY_SCENARIO.terrain)
    expect(obbs).toHaveLength(boxes.length)
    boxes.forEach((box, index) => {
      const expected = group.localToWorld(new Vector3(box.x, box.y + box.h / 2, box.z))
      const obb = obbs[index]!
      expect(obb.center.x).toBeCloseTo(expected.x, 9)
      expect(obb.center.y).toBeCloseTo(expected.y, 9)
      expect(obb.center.z).toBeCloseTo(expected.z, 9)
      expectAxesLikeScene(obb, group)
    })
  })

  it('a caixa simples também gira com o sinal da cena (30°)', () => {
    const box: Obstacle = {
      id: 'c',
      label: 'Caixa FICTÍCIA',
      kind: 'box',
      centerX: 2,
      centerZ: 3,
      widthM: 6,
      depthM: 1,
      heightM: 2,
      rotationYDeg: 30,
    }
    expectAxesLikeScene(obstacleObb(box, EMPTY_SCENARIO.terrain), sceneGroup(box))
  })

  it('escala o tamanho do obstáculo junto com as caixas', () => {
    const terrain = EMPTY_SCENARIO.terrain
    const normal = obstacleObbs(shed(), terrain)
    const wide = obstacleObbs(shed({ widthM: 38.44 }), terrain)
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
