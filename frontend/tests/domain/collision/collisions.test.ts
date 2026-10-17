import { describe, expect, it } from 'vitest'

import {
  ACCESSORY_CHAIN_HALF_WIDTH_M,
  collisionStateKey,
  type CollisionInput,
  type CraneBody,
  craneBodyObbs,
  describeAlert,
  describeHit,
  evaluateCollisions,
  GROUND_CARGO_ID,
  NO_COLLISION,
  obstacleObb,
  payloadObbs,
} from '../../../src/domain/collision/collisions'
import { computeLoadBox } from '../../../src/domain/collision/loadBox'
import {
  EMPTY_SCENARIO,
  type Obstacle,
  type ScenarioSpec,
  terrainHeightAt,
} from '../../../src/domain/environment/environment'
import { calculateOperationalGeometry } from '../../../src/domain/geometry/operationalGeometry'

const GEOMETRY = { boomPivotOffsetM: -1.56, boomPivotHeightM: 3.3 }
const STATE = { turretRotationDeg: 0, boomAngleDeg: 35, boomLengthM: 12, cableLengthM: 5 }
const LOAD = computeLoadBox({ lengthM: 4, widthM: 2, heightM: 1.5 }, 1.05)
const HOOK = { center: { x: 0, y: -0.55, z: 0 }, half: { x: 0.3, y: 0.5, z: 0.3 } }

const BODY: CraneBody = {
  boxes: [
    {
      id: 'crane-base',
      frame: 'base',
      center: { x: 0, y: 1, z: 1.5 },
      half: { x: 1.3, y: 1, z: 4 },
    },
    {
      id: 'crane-turret',
      frame: 'turret',
      center: { x: 0, y: 0.5, z: 0 },
      half: { x: 1.2, y: 0.5, z: 1.8 },
    },
    {
      id: 'crane-boom',
      frame: 'boom',
      center: { x: 0, y: 0, z: 6 },
      half: { x: 0.45, y: 0.45, z: 6 },
    },
  ],
  turretOffset: { x: 0, y: 1.6, z: 0 },
  boomPivot: { x: 0, y: 1.7, z: -1.56 },
  extensionOffset: { x: 0, y: 0, z: 0 },
  boomRetractedLengthM: 12,
}

const wall: Obstacle = {
  id: 'obs-1',
  label: 'Muro FICTÍCIO',
  kind: 'box',
  centerX: 0,
  centerZ: 8.3,
  widthM: 6,
  depthM: 1,
  heightM: 8,
  rotationYDeg: 0,
}

function input(overrides: Partial<CollisionInput> = {}): CollisionInput {
  return {
    state: STATE,
    geometryParameters: GEOMETRY,
    scenario: EMPTY_SCENARIO,
    body: BODY,
    load: LOAD,
    hook: HOOK,
    ...overrides,
  }
}

const withObstacles = (...obstacles: Obstacle[]): ScenarioSpec => ({ ...EMPTY_SCENARIO, obstacles })

describe('evaluateCollisions', () => {
  it('a pose inicial, no chão plano, não colide nem alerta', () => {
    expect(evaluateCollisions(input())).toEqual({ hits: [], alerts: [], penetrationM: 0 })
  })

  it('terreno: cabo longo leva a carga ao chão; sem carga, é o gancho', () => {
    const withLoad = evaluateCollisions(input({ state: { ...STATE, cableLengthM: 12 } }))
    expect(withLoad.hits.map((h) => [h.subject, h.target.kind])).toContainEqual(['load', 'terrain'])
    const noLoad = evaluateCollisions(input({ state: { ...STATE, cableLengthM: 14 }, load: null }))
    expect(noLoad.hits.map((h) => [h.subject, h.target.kind])).toEqual([['hook', 'terrain']])
  })

  it('terreno: acompanha elevação, não só o plano y = 0', () => {
    const hill: ScenarioSpec = {
      ...EMPTY_SCENARIO,
      terrain: {
        slopeXPercent: 0,
        slopeZPercent: 0,
        features: [{ id: 'm', kind: 'mound', centerX: 0, centerZ: 8.3, radiusM: 4, heightM: 6 }],
      },
    }
    expect(terrainHeightAt(hill.terrain, 0, 8.3)).toBeCloseTo(6)
    expect(evaluateCollisions(input({ scenario: hill })).hits.length).toBeGreaterThan(0)
  })

  it('obstáculo: carga que o atravessa bate; cabo e lança só alertam', () => {
    const hit = evaluateCollisions(input({ scenario: withObstacles(wall) }))
    expect(hit.hits.some((h) => h.target.kind === 'obstacle')).toBe(true)

    const post: Obstacle = { ...wall, id: 'poste', widthM: 0.2, depthM: 0.2 }
    const alert = evaluateCollisions(
      input({ scenario: withObstacles(post), load: null, hook: null }),
    )
    expect(alert.hits).toEqual([])
    expect(alert.alerts.map((a) => a.segment)).toEqual(['cable'])
    expect(describeAlert(alert.alerts[0])).toContain('O cabo')

    const boomOnly = evaluateCollisions(
      input({
        scenario: withObstacles({ ...post, centerZ: 4, heightM: 20 }),
        load: null,
        hook: null,
      }),
    )
    expect(boomOnly.alerts.map((a) => a.segment)).toEqual(['boom'])
  })

  it('corpo do guindaste: carga com a lança quase vertical bate na torre', () => {
    const upright = { turretRotationDeg: 0, boomAngleDeg: 80, boomLengthM: 12, cableLengthM: 8 }
    const result = evaluateCollisions(input({ state: upright }))
    expect(result.hits.some((h) => h.subject === 'load' && h.target.kind === 'crane')).toBe(true)
  })

  it('o gancho sem carga não atravessa o chassi nem a torre, mas sobe até a lança', () => {
    const upright = { turretRotationDeg: 0, boomAngleDeg: 80, boomLengthM: 12, cableLengthM: 1 }
    const nearBoom = evaluateCollisions(input({ state: upright, load: null }))
    expect(nearBoom.hits.some((h) => h.target.kind === 'crane')).toBe(false)

    // Lança baixa e cabo comprido: o gancho desce sobre a carroceria (o chassi estende-se a +z).
    const low = { turretRotationDeg: 0, boomAngleDeg: 0, boomLengthM: 4, cableLengthM: 1.5 }
    const onBody = evaluateCollisions(input({ state: low, load: null }))
    expect(onBody.hits.some((h) => h.subject === 'hook' && h.target.kind === 'crane')).toBe(true)
    expect(onBody.penetrationM).toBeGreaterThan(0)
  })

  it('segue a posição e o rumo do guindaste no cenário', () => {
    const moved: ScenarioSpec = { ...withObstacles(wall), crane: { x: 30, z: 0, headingDeg: 0 } }
    expect(evaluateCollisions(input({ scenario: moved })).hits).toEqual([])
    const turned: ScenarioSpec = { ...withObstacles(wall), crane: { x: 0, z: 0, headingDeg: 90 } }
    expect(evaluateCollisions(input({ scenario: turned })).hits).toEqual([])
  })
})

describe('geometria dos objetos', () => {
  it('a caixa da carga fica abaixo de G, com os eixos da torre', () => {
    const [, load] = payloadObbs(input({ state: { ...STATE, turretRotationDeg: 90 } }))
    expect(load.obb.center.y).toBeLessThan(5.18)
    // ψ = 90°: o comprimento (z local) aponta para +X.
    expect(load.obb.axes[2].x).toBeCloseTo(1)
  })

  it('obstáculo apoia no terreno; cilindro vira a caixa que o envolve', () => {
    const terrain = { slopeXPercent: 10, slopeZPercent: 0, features: [] }
    const cylinder: Obstacle = {
      ...wall,
      kind: 'cylinder',
      centerX: 10,
      centerZ: 0,
      widthM: 2,
      depthM: 9,
    }
    const obb = obstacleObb(cylinder, terrain)
    expect(obb.center.y).toBeCloseTo(1 + 4)
    expect(obb.half.z).toBe(1)
  })

  it('o corpo acompanha giro e inclinação da lança', () => {
    const boomAt = (state: typeof STATE) =>
      craneBodyObbs(BODY, state, EMPTY_SCENARIO).find((b) => b.id === 'crane-boom')!.obb
    const low = boomAt({ ...STATE, boomAngleDeg: 0 })
    const high = boomAt({ ...STATE, boomAngleDeg: 60 })
    expect(high.center.y).toBeGreaterThan(low.center.y)
    const turned = boomAt({ ...STATE, boomAngleDeg: 0, turretRotationDeg: 90 })
    expect(turned.center.x).toBeGreaterThan(4)
  })
})

describe('cadeia de acessórios (TASK-091; F-10)', () => {
  // Gancho giratório + manilha: 0,75 m de cadeia abaixo do ponto de amarração (1,05 m abaixo de G).
  // FICTÍCIO (ADR-012).
  const CHAIN = { topM: 1.05, dropM: 0.75 }
  /** Cabo que deixa G a `heightM` do chão plano, na pose de `STATE`. */
  const cableForHookAt = (heightM: number) =>
    calculateOperationalGeometry(STATE, GEOMETRY).boomTip.yM - heightM

  it('vira uma caixa de G − 1,05 m a G − 1,80 m, nos eixos do gancho', () => {
    const parts = payloadObbs(input({ load: null, chain: CHAIN }))
    const chain = parts.find((part) => part.subject === 'accessories')!.obb
    const hookY = calculateOperationalGeometry(STATE, GEOMETRY).hook.yM
    expect(chain.center.y + chain.half.y).toBeCloseTo(hookY - 1.05)
    expect(chain.center.y - chain.half.y).toBeCloseTo(hookY - 1.8)
    expect(chain.half.x).toBe(ACCESSORY_CHAIN_HALF_WIDTH_M)
    // Sem cadeia (ou sem altura), nada muda.
    expect(payloadObbs(input({ load: null })).map((part) => part.subject)).toEqual(['hook'])
    expect(
      payloadObbs(input({ load: null, chain: { topM: 1.05, dropM: 0 } })).map((p) => p.subject),
    ).toEqual(['hook'])
  })

  it('sem carga, o gancho ainda acima do chão: o fim da cadeia é que bate no terreno', () => {
    // G a 1,4 m: o gancho termina a 0,35 m do chão, mas a cadeia desce até −0,40 m.
    const state = { ...STATE, cableLengthM: cableForHookAt(1.4) }
    const report = evaluateCollisions(input({ state, load: null, chain: CHAIN }))
    expect(report.hits.map((hit) => [hit.subject, hit.target.kind])).toEqual([
      ['accessories', 'terrain'],
    ])
    expect(report.penetrationM).toBeCloseTo(0.4, 3)
    expect(describeHit(report.hits[0]!)).toBe('A cadeia de acessórios atingiria o terreno.')
    // Antes da TASK-091, sem a cadeia, nada colidia nessa pose.
    expect(evaluateCollisions(input({ state, load: null })).hits).toEqual([])
  })

  it('a cadeia não entra na carga apoiada no chão', () => {
    const hook = calculateOperationalGeometry(STATE, GEOMETRY).hook
    // Carga no chão logo abaixo do gancho, com o topo 0,5 m abaixo do fim do gancho.
    const cargo: Obstacle = {
      id: GROUND_CARGO_ID,
      label: 'Carga',
      kind: 'box',
      centerX: hook.xM,
      centerZ: hook.zM,
      widthM: 2,
      depthM: 3,
      heightM: hook.yM - 1.05 - 0.5,
      rotationYDeg: 0,
    }
    const report = evaluateCollisions(
      input({ scenario: withObstacles(cargo), load: null, chain: CHAIN }),
    )
    expect(report.hits.map((hit) => [hit.subject, hit.target.kind])).toEqual([
      ['accessories', 'obstacle'],
    ])
    expect(describeHit(report.hits[0]!)).toBe('A cadeia de acessórios atingiria a carga no chão.')
  })

  it('como o gancho, a cadeia bate no chassi, mas não na lança de onde pende', () => {
    // Lança baixa sobre a carroceria (topo a 2 m): o gancho termina a 2,05 m, e a cadeia desce até
    // 1,30 m, para dentro do chassi.
    const low = { turretRotationDeg: 0, boomAngleDeg: 0, boomLengthM: 4, cableLengthM: 0.2 }
    expect(evaluateCollisions(input({ state: low, load: null })).hits).toEqual([])
    const report = evaluateCollisions(input({ state: low, load: null, chain: CHAIN }))
    expect(report.hits.some((h) => h.subject === 'accessories' && h.target.kind === 'crane')).toBe(
      true,
    )
    expect(
      report.hits.some(
        (h) =>
          h.subject === 'accessories' &&
          h.target.kind === 'crane' &&
          h.target.part === 'crane-boom',
      ),
    ).toBe(false)
  })
})

describe('textos e chave', () => {
  it('descrevem o que foi atingido e distinguem os estados', () => {
    const { hits } = evaluateCollisions(input({ state: { ...STATE, cableLengthM: 12 } }))
    expect(describeHit(hits.find((hit) => hit.subject === 'load')!)).toBe(
      'A carga atingiria o terreno.',
    )
    expect(collisionStateKey(NO_COLLISION)).not.toBe(
      collisionStateKey({ hits, alerts: [], penetrationM: 1, blocked: true }),
    )
  })
})
