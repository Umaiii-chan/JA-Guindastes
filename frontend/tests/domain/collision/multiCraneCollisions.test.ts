import { describe, expect, it } from 'vitest'

import {
  type CollisionInput,
  type CraneBody,
  describeHit,
  evaluateCollisions,
  payloadObbs,
} from '../../../src/domain/collision/collisions'
import { computeLoadBox } from '../../../src/domain/collision/loadBox'
import {
  type CranePayload,
  evaluateMultiCraneCollisions,
  type HoistedCargo,
  type MultiCrane,
} from '../../../src/domain/collision/multiCraneCollisions'
import {
  EMPTY_SCENARIO,
  type Obstacle,
  type ScenarioSpec,
} from '../../../src/domain/environment/environment'
import { findLibraryObject, newModelObstacle } from '../../../src/domain/environment/objectLibrary'

// Corpo FICTÍCIO: só uma caixa de lança de 10 m, a partir do pino a 3 m de altura.
const BODY: CraneBody = {
  boxes: [
    { id: 'lança', frame: 'boom', center: { x: 0, y: 0, z: 5 }, half: { x: 0.4, y: 0.4, z: 5 } },
  ],
  turretOffset: { x: 0, y: 0, z: 0 },
  boomPivot: { x: 0, y: 3, z: 0 },
  extensionOffset: { x: 0, y: 0, z: 0 },
  boomRetractedLengthM: 10,
}

const STATE = { turretRotationDeg: 0, boomAngleDeg: 0, boomLengthM: 10, cableLengthM: 3 }

function crane(label: string, x: number, z: number, headingDeg: number): MultiCrane {
  return { label, placement: { x, z, headingDeg }, state: STATE, body: BODY }
}

describe('colisões entre os guindastes', () => {
  it('lança contra lança que se cruzam', () => {
    const report = evaluateMultiCraneCollisions({
      scenario: EMPTY_SCENARIO,
      cranes: [crane('Guindaste 1', -6, 0, 90), crane('Guindaste 2', 6, 0, -90)],
      cargo: null,
    })

    expect(report.hits.length).toBeGreaterThan(0)
    expect(report.hits.every((hit) => hit.subject === 'crane')).toBe(true)
    expect(report.penetrationM).toBeGreaterThan(0)
  })

  it('sem colisão quando as lanças passam lado a lado', () => {
    const report = evaluateMultiCraneCollisions({
      scenario: EMPTY_SCENARIO,
      cranes: [crane('Guindaste 1', -6, -3, 90), crane('Guindaste 2', 6, 3, -90)],
      cargo: null,
    })

    expect(report.hits).toEqual([])
    expect(report.penetrationM).toBe(0)
  })

  it('sem colisão quando uma lança passa acima da outra', () => {
    const high = { ...crane('Guindaste 2', 6, 0, -90), state: { ...STATE, boomAngleDeg: 0 } }
    const raisedBody: CraneBody = { ...BODY, boomPivot: { x: 0, y: 9, z: 0 } }

    const report = evaluateMultiCraneCollisions({
      scenario: EMPTY_SCENARIO,
      cranes: [crane('Guindaste 1', -6, 0, 90), { ...high, body: raisedBody }],
      cargo: null,
    })

    expect(report.hits).toEqual([])
  })
})

describe('colisões da carga içada', () => {
  const cargo: HoistedCargo = {
    x: 0,
    z: 0,
    rotationYDeg: 0,
    bottomY: 1,
    lengthM: 4,
    widthM: 2,
    heightM: 1,
  }
  const apart = [crane('Guindaste 1', -20, 0, 90), crane('Guindaste 2', 20, 0, -90)]

  it('carga suspensa e livre não colide', () => {
    const report = evaluateMultiCraneCollisions({ scenario: EMPTY_SCENARIO, cranes: apart, cargo })

    expect(report.hits).toEqual([])
  })

  it('carga abaixo do terreno colide com ele', () => {
    const report = evaluateMultiCraneCollisions({
      scenario: EMPTY_SCENARIO,
      cranes: apart,
      cargo: { ...cargo, bottomY: -0.3 },
    })

    expect(report.hits.map((hit) => hit.target.kind)).toContain('terrain')
    expect(report.penetrationM).toBeGreaterThan(0)
  })

  it('carga contra um obstáculo', () => {
    const scenario = {
      ...EMPTY_SCENARIO,
      obstacles: [
        {
          id: 'o1',
          label: 'Caixa',
          kind: 'box' as const,
          centerX: 0,
          centerZ: 0,
          widthM: 2,
          depthM: 2,
          heightM: 3,
          rotationYDeg: 0,
        },
      ],
    }

    const report = evaluateMultiCraneCollisions({ scenario, cranes: apart, cargo })

    expect(report.hits.map((hit) => hit.target.kind)).toContain('obstacle')
  })

  it('carga contra o corpo de um dos guindastes', () => {
    const near = [crane('Guindaste 1', -6, 0, 90), crane('Guindaste 2', 40, 0, -90)]

    const report = evaluateMultiCraneCollisions({
      scenario: EMPTY_SCENARIO,
      cranes: near,
      cargo: { ...cargo, bottomY: 2.7, heightM: 0.6 },
    })

    expect(report.hits.some((hit) => hit.subject === 'load' && hit.target.kind === 'crane')).toBe(
      true,
    )
  })
})

// --- TASK-091 (F-07): carga, gancho, cadeia e cabo de um guindaste contra os outros, fora do tandem.

// Corpo FICTÍCIO completo (chassi, torre e lança de 12 m), o mesmo de `collisions.test.ts`.
const FULL_BODY: CraneBody = {
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
const GEOMETRY = { boomPivotOffsetM: -1.56, boomPivotHeightM: 3.3 }
const HOOK = { center: { x: 0, y: -0.55, z: 0 }, half: { x: 0.3, y: 0.5, z: 0.3 } }
// Carga FICTÍCIA de 4 × 2 × 1,5 m pendurada pelas lingas.
const LOAD = computeLoadBox({ lengthM: 4, widthM: 2, heightM: 1.5 }, 1.05)
// Lingas a 45° (F-19, ângulo informado): com o padrão de 60° a carga desceria ao chão nas poses do galpão.
const LOAD_45 = computeLoadBox({ lengthM: 4, widthM: 2, heightM: 1.5 }, 1.05, 0, null, 45)

describe('o que pende de um guindaste contra os outros (TASK-091; F-07)', () => {
  // Cenário da auditoria: guindaste 1 em (0; 0), θ 35°, L 12 m, c 3,1 m, com a carga; guindaste 2 em
  // (−5; 8,27), rumo 90°, lança horizontal, atravessando por baixo do gancho do 1.
  const first = (payload: CranePayload | null): MultiCrane => ({
    label: 'Guindaste 1',
    placement: { x: 0, z: 0, headingDeg: 0 },
    // Cabo de 1,23 m (antes 3,1): as lingas da geometria única (F-19) têm 3,87 m, não 2 m.
    state: { turretRotationDeg: 0, boomAngleDeg: 35, boomLengthM: 12, cableLengthM: 1.23 },
    body: FULL_BODY,
    payload,
  })
  const second = (payload: CranePayload | null = null): MultiCrane => ({
    label: 'Guindaste 2',
    placement: { x: -5, z: 8.27, headingDeg: 90 },
    state: { turretRotationDeg: 0, boomAngleDeg: 0, boomLengthM: 12, cableLengthM: 2 },
    body: FULL_BODY,
    payload,
  })
  const withLoad: CranePayload = { geometryParameters: GEOMETRY, load: LOAD, hook: HOOK }

  it('a carga do 1 dentro da lança do 2 bloqueia, com o nome dos dois na mensagem', () => {
    // A própria guarda do 1 não vê o outro guindaste...
    const own: CollisionInput = {
      state: first(null).state,
      geometryParameters: GEOMETRY,
      scenario: EMPTY_SCENARIO,
      body: FULL_BODY,
      load: LOAD,
      hook: HOOK,
    }
    expect(evaluateCollisions(own).hits).toEqual([])
    // ...e, sem o que pende de cada um, só o corpo contra corpo era comparado (o erro da auditoria).
    const before = evaluateMultiCraneCollisions({
      scenario: EMPTY_SCENARIO,
      cranes: [first(null), second()],
      cargo: null,
    })
    expect(before.hits).toEqual([])

    const report = evaluateMultiCraneCollisions({
      scenario: EMPTY_SCENARIO,
      cranes: [first(withLoad), second()],
      cargo: null,
    })
    const loadHit = report.hits.find((hit) => hit.subject === 'load')
    expect(loadHit).toMatchObject({
      subject: 'load',
      owner: 'Guindaste 1',
      target: { kind: 'other-crane', part: 'lança do Guindaste 2' },
    })
    // A auditoria mediu 1,18 m de penetração da carga na lança.
    expect(report.penetrationM).toBeGreaterThan(0.5)
    expect(describeHit(loadHit!)).toBe(
      'A carga do Guindaste 1 atingiria o outro guindaste (lança do Guindaste 2).',
    )
  })

  it('vale nos dois sentidos: a lança do 2 que entra na carga pendurada no 1', () => {
    const report = evaluateMultiCraneCollisions({
      scenario: EMPTY_SCENARIO,
      cranes: [second(), first(withLoad)],
      cargo: null,
    })
    expect(report.hits.some((hit) => hit.subject === 'load' && hit.owner === 'Guindaste 1')).toBe(
      true,
    )
  })

  it('sem carga, o gancho e a cadeia de acessórios do 1 também não atravessam o 2', () => {
    // Cabo mais longo (G a ~3,7 m): o gancho desce na altura da lança do 2.
    const lowHook: MultiCrane = {
      ...first({ geometryParameters: GEOMETRY, load: null, hook: HOOK }),
      state: { ...first(null).state, cableLengthM: 6.5 },
    }
    const hookReport = evaluateMultiCraneCollisions({
      scenario: EMPTY_SCENARIO,
      cranes: [lowHook, second()],
      cargo: null,
    })
    expect(hookReport.hits.map((hit) => [hit.subject, hit.owner])).toContainEqual([
      'hook',
      'Guindaste 1',
    ])

    // Gancho acima da lança do 2, mas a cadeia (0,75 m, FICTÍCIA) desce até ela.
    const chained: MultiCrane = {
      ...first({
        geometryParameters: GEOMETRY,
        load: null,
        hook: HOOK,
        chain: { topM: 1.05, dropM: 0.75 },
      }),
      state: { ...first(null).state, cableLengthM: 5.2 },
    }
    const noChain = evaluateMultiCraneCollisions({
      scenario: EMPTY_SCENARIO,
      cranes: [{ ...chained, payload: { ...chained.payload!, chain: null } }, second()],
      cargo: null,
    })
    expect(noChain.hits).toEqual([])
    const chainReport = evaluateMultiCraneCollisions({
      scenario: EMPTY_SCENARIO,
      cranes: [chained, second()],
      cargo: null,
    })
    expect(chainReport.hits.map((hit) => [hit.subject, hit.owner])).toEqual([
      ['accessories', 'Guindaste 1'],
    ])
  })

  it('o cabo do 1 contra a lança do 2, mais alta que o gancho', () => {
    // A lança do 2 a ~7 m de altura (pino mais alto): passa entre a ponta do 1 (10,2 m) e o gancho
    // dele (4,2 m), atravessando só o cabo.
    const tall: CraneBody = { ...FULL_BODY, boomPivot: { x: 0, y: 5.4, z: -1.56 } }
    const report = evaluateMultiCraneCollisions({
      scenario: EMPTY_SCENARIO,
      cranes: [
        {
          ...first({ geometryParameters: GEOMETRY, load: null, hook: HOOK }),
          state: { ...first(null).state, cableLengthM: 6 },
        },
        { ...second(), body: tall },
      ],
      cargo: null,
    })
    expect(report.hits.map((hit) => [hit.subject, hit.owner, hit.target.kind])).toEqual([
      ['cable', 'Guindaste 1', 'other-crane'],
    ])
    expect(report.penetrationM).toBeGreaterThan(0)
    expect(describeHit(report.hits[0]!)).toBe(
      'O cabo do Guindaste 1 atingiria o outro guindaste (lança do Guindaste 2).',
    )
  })

  it('guindastes afastados não acusam nada', () => {
    const report = evaluateMultiCraneCollisions({
      scenario: EMPTY_SCENARIO,
      cranes: [
        first(withLoad),
        { ...second(withLoad), placement: { x: -30, z: 8.27, headingDeg: 90 } },
      ],
      cargo: null,
    })
    expect(report.hits).toEqual([])
    expect(report.penetrationM).toBe(0)
  })
})

describe('tandem e objetos da biblioteca (TASK-091; F-23)', () => {
  // Galpão aberto FICTÍCIO com a porta para o guindaste, como em `objectCollisions.test.ts`.
  const shed: Obstacle = {
    ...newModelObstacle(findLibraryObject('barracao-aberto')!, 'barracao-1', 'Galpão FICTÍCIO'),
    centerX: 0,
    centerZ: 22,
    rotationYDeg: 180,
  }
  const scenario: ScenarioSpec = { ...EMPTY_SCENARIO, obstacles: [shed] }

  /** A carga içada na mesma caixa da carga pendurada num guindaste só, no estado dado. */
  function cargoAt(turretRotationDeg: number): HoistedCargo {
    const obb = payloadObbs({
      state: { turretRotationDeg, boomAngleDeg: 8, boomLengthM: 20, cableLengthM: 0.5 },
      geometryParameters: GEOMETRY,
      scenario,
      body: null,
      load: LOAD_45,
      hook: null,
    }).find((part) => part.subject === 'load')!.obb
    return {
      x: obb.center.x,
      z: obb.center.z,
      rotationYDeg: turretRotationDeg,
      bottomY: obb.center.y - obb.half.y,
      lengthM: 4,
      widthM: 2,
      heightM: 1.5,
    }
  }

  it('a carga dentro do galpão aberto não colide (antes, a caixa envolvente dava falso alarme)', () => {
    const report = evaluateMultiCraneCollisions({ scenario, cranes: [], cargo: cargoAt(0) })
    expect(report.hits).toEqual([])
  })

  it('de lado, a carga bate na parede do galpão, como com um guindaste só', () => {
    const report = evaluateMultiCraneCollisions({ scenario, cranes: [], cargo: cargoAt(28) })
    expect(report.hits.some((hit) => hit.target.kind === 'obstacle')).toBe(true)
  })
})
