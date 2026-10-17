// Carga solta sobre a carroceria como obstáculo (TASK-103): a base fica na altura da carroceria, sem
// descer até o terreno por dentro do caminhão. Sem WebGL.

import { describe, expect, it } from 'vitest'

import { cargoSupport } from '../../../src/domain/cargo/cargoOperation'
import { GROUND_CARGO_ID, obstacleObb } from '../../../src/domain/collision/collisions'
import {
  EMPTY_SCENARIO,
  type Obstacle,
  type ScenarioSpec,
} from '../../../src/domain/environment/environment'
import { findLibraryObject, newModelObstacle } from '../../../src/domain/environment/objectLibrary'
import { buildCraneScene } from '../../../src/three/scene/buildCraneScene'
import { groundObstacle } from '../../../src/three/scene/CargoOperation'

const BED_TOP = 1.86
const SIZE = { lengthM: 2, widthM: 2, heightM: 1 }

function truckAt(x: number, z: number): Obstacle {
  const object = findLibraryObject('caminhao-plataforma')
  if (!object) throw new Error('sem caminhão plataforma')
  return { ...newModelObstacle(object, 'truck-1', 'caminhao-plataforma'), centerX: x, centerZ: z }
}

describe('colisão da carga solta sobre a carroceria', () => {
  it('sobre a carroceria, o prisma vai do topo dela ao topo da carga', () => {
    const truck = truckAt(0, 0)
    const pose = { x: 0, z: -1.85, rotationYDeg: 0 }
    const support = cargoSupport(EMPTY_SCENARIO.terrain, SIZE, pose, [truck])
    const obstacle = groundObstacle(SIZE, pose, 0, support)
    expect(obstacle.heightM).toBe(SIZE.heightM)
    expect(obstacle.baseElevationM).toBeCloseTo(BED_TOP, 6)
    const obb = obstacleObb(obstacle, EMPTY_SCENARIO.terrain)
    // Centro da caixa a meia altura da carga acima do topo da carroceria.
    expect(obb.center.y).toBeCloseTo(BED_TOP + SIZE.heightM / 2, 6)
    expect(obb.half.y).toBeCloseTo(SIZE.heightM / 2, 6)
  })

  it('no terreno, o prisma vai do terreno ao topo da carga, como antes', () => {
    const pose = { x: 6, z: 0, rotationYDeg: 0 }
    const support = cargoSupport(EMPTY_SCENARIO.terrain, SIZE, pose, [truckAt(0, 0)])
    const obstacle = groundObstacle(SIZE, pose, 0, support)
    expect(obstacle.baseElevationM).toBeUndefined()
    expect(obstacle.heightM).toBe(SIZE.heightM)
    expect(obstacleObb(obstacle, EMPTY_SCENARIO.terrain).center.y).toBeCloseTo(SIZE.heightM / 2, 6)
  })

  it('na cena, a carga sobre o caminhão vira obstáculo com a base na carroceria', () => {
    const contents = buildCraneScene()
    const spec: ScenarioSpec = {
      ...EMPTY_SCENARIO,
      obstacles: [truckAt(30, 0)],
      cargo: { x: 30, z: -1.85, rotationYDeg: 0 },
    }
    contents.cargo.setLoad(SIZE)
    contents.cargo.setScenario(spec)
    const cargo = contents.collisions.effectiveScenario.obstacles.find(
      (obstacle) => obstacle.id === GROUND_CARGO_ID,
    )
    expect(cargo?.baseElevationM).toBeCloseTo(BED_TOP, 6)
    expect(cargo?.heightM).toBe(SIZE.heightM)

    // Carga com o centro fora da carroceria: assenta no terreno.
    contents.cargo.setScenario({ ...spec, cargo: { x: 30, z: 1.5, rotationYDeg: 0 } })
    const beside = contents.collisions.effectiveScenario.obstacles.find(
      (obstacle) => obstacle.id === GROUND_CARGO_ID,
    )
    expect(beside?.baseElevationM).toBeUndefined()
  })
})
