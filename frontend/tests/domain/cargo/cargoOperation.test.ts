import { describe, expect, it } from 'vitest'

import {
  cargoBaseY,
  cargoStatusOf,
  checkEngage,
  checkRelease,
  clearResult,
  engageCargo,
  type HookReference,
  initialCargoState,
  releaseCargo,
} from '../../../src/domain/cargo/cargoOperation'
import { rotY } from '../../../src/domain/collision/obb'
import {
  type DeliveryPoint,
  EMPTY_SCENARIO,
  type TerrainSpec,
} from '../../../src/domain/environment/environment'
import { defaultGeometry, slingDropOf } from '../../../src/domain/rigging/slingGeometry'

// Dados FICTÍCIOS: carga de 4 m × 2 m × 1,5 m sobre o plano, em (10, 0).
const SIZE = { lengthM: 4, widthM: 2, heightM: 1.5 }
// F-19: a altura das lingas é a da geometria única (60° com a horizontal: queda = r·tan 60°).
const DROP = slingDropOf(SIZE.lengthM, SIZE.widthM)
/** G com as lingas esticadas sobre a carga no chão: topo (1,5) + engate (1) + lingas. */
const G0 = SIZE.heightM + 1 + DROP
const FLAT: TerrainSpec = EMPTY_SCENARIO.terrain
const DELIVERY: DeliveryPoint = { x: 0, z: 10, rotationYDeg: 0, radiusM: 2 }

function hookAt(x: number, y: number, z: number, yawDeg = 0): HookReference {
  return {
    frame: { rot: rotY((yawDeg * Math.PI) / 180), pos: { x, y, z } },
    yawDeg,
    attachOffsetM: 1,
    accessoriesDropM: 0,
  }
}

const START = initialCargoState({ x: 10, z: 0, rotationYDeg: 0 })

describe('engatar', () => {
  it('liga com o gancho até 0,5 m acima do ponto em que as lingas esticam, alinhado a 0,5 m', () => {
    // Topo em 1,5 m; as lingas esticam com o fim do gancho a `DROP` acima do topo; ele está 0,4 m
    // acima disso.
    const check = checkEngage(hookAt(10.3, G0 + 0.4, 0), START, SIZE, FLAT)
    expect(check.slingDropM).toBeCloseTo(DROP, 9)
    expect(check.gapM).toBeCloseTo(DROP + 0.4, 6)
    expect(check.offsetM).toBeCloseTo(0.3, 6)
    expect(check.canEngage).toBe(true)
  })

  it('não liga alto demais, desalinhado ou com as lingas frouxas (gancho baixo)', () => {
    expect(checkEngage(hookAt(10, G0 + 0.7, 0), START, SIZE, FLAT).canEngage).toBe(false)
    expect(checkEngage(hookAt(10.8, G0 + 0.2, 0), START, SIZE, FLAT).canEngage).toBe(false)
    // Mais baixo que o ponto das lingas esticadas (a antiga regra "até 0,5 m do topo" não vale mais).
    expect(checkEngage(hookAt(10, G0 - 0.5, 0), START, SIZE, FLAT).canEngage).toBe(false)
    expect(checkEngage(hookAt(10, 1.5 + 1 + 0.4, 0), START, SIZE, FLAT).canEngage).toBe(false)
  })

  it('conta a cadeia de acessórios abaixo do gancho', () => {
    const hook = { ...hookAt(10, G0 + 0.4 + 2, 0), accessoriesDropM: 2 }
    // Fim da cadeia 0,4 m acima do ponto das lingas esticadas.
    expect(checkEngage(hook, START, SIZE, FLAT).gapM).toBeCloseTo(DROP + 0.4, 6)
    expect(checkEngage(hook, START, SIZE, FLAT).canEngage).toBe(true)
  })

  it('o ângulo informado muda as lingas: 45° baixa o ponto de engate', () => {
    const hook = { ...hookAt(10, 0, 0), slingAngleDeg: 45 }
    const drop45 = defaultGeometry(SIZE.lengthM, SIZE.widthM, { angleDeg: 45 }).dropM
    expect(drop45).toBeLessThan(DROP)
    const at45 = checkEngage(
      { ...hook, frame: { ...hook.frame, pos: { x: 10, y: 1.5 + 1 + drop45, z: 0 } } },
      START,
      SIZE,
      FLAT,
    )
    expect(at45.slingDropM).toBeCloseTo(drop45, 9)
    expect(at45.canEngage).toBe(true)
  })

  it('assenta a carga no ponto mais alto do terreno sob a pegada', () => {
    const slope: TerrainSpec = { slopeXPercent: 10, slopeZPercent: 0, features: [] }
    const base = cargoBaseY(slope, SIZE, { x: 10, z: 0, rotationYDeg: 0 })
    // Largura 2 m ao longo de X: a borda de +X está em x = 11 → 1,1 m.
    expect(base).toBeCloseTo(1.1, 6)
  })

  it('guarda o deslocamento e usa a altura das lingas da geometria única, não a folga medida', () => {
    const hooked = engageCargo(START, hookAt(10.3, G0 + 0.4, 0), SIZE)
    expect(hooked.phase).toBe('hooked')
    expect(hooked.hooked?.offsetX).toBeCloseTo(-0.3, 6)
    expect(hooked.hooked?.offsetZ).toBeCloseTo(0, 6)
    // Folga medida seria DROP + 0,4; a altura das lingas é a da geometria (F-19).
    expect(hooked.hooked?.slingDropM).toBeCloseTo(DROP, 3)
    expect(hooked.hooked?.slingAngleDeg).toBeCloseTo(60, 3)
    expect(hooked.hooked?.slingLengthM).toBeCloseTo(
      defaultGeometry(SIZE.lengthM, SIZE.widthM).lengthM,
      3,
    )
  })

  it('guarda o giro em relação ao referencial do gancho', () => {
    const turned = initialCargoState({ x: 10, z: 0, rotationYDeg: 90 })
    const hooked = engageCargo(turned, hookAt(10, G0 + 0.4, 0, 30), SIZE)
    expect(hooked.hooked?.yawDeg).toBeCloseTo(60, 6)
  })
})

describe('soltar e entregar', () => {
  const hooked = engageCargo(START, hookAt(10, G0, 0), SIZE)

  it('só solta com a base a até 0,2 m do chão', () => {
    // Base = G − 1 − DROP (lingas) − 1,5 (altura) = G − G0.
    expect(checkRelease(hookAt(10, G0 + 2.1, 0), hooked.hooked!, SIZE, FLAT).canRelease).toBe(false)
    const near = checkRelease(hookAt(10, G0 + 0.1, 0), hooked.hooked!, SIZE, FLAT)
    expect(near.heightAboveGroundM).toBeCloseTo(0.1, 3) // lingas guardadas em milímetros
    expect(near.canRelease).toBe(true)
  })

  it('dentro do raio, marca entregue com o tempo da operação', () => {
    const released = releaseCargo(hooked, hookAt(0.5, G0, 10), SIZE, FLAT, DELIVERY, 42_300)
    expect(released.phase).toBe('ground')
    expect(released.result).toBe('delivered')
    expect(released.elapsedMs).toBe(42_300)
    expect(released.x).toBeCloseTo(0.5, 3)
    expect(released.z).toBeCloseTo(10, 3)
  })

  it('fora do raio, a carga fica onde caiu e o resultado é "fora"', () => {
    const released = releaseCargo(hooked, hookAt(5, G0, 10), SIZE, FLAT, DELIVERY, 10_000)
    expect(released.result).toBe('outside')
    expect(released.elapsedMs).toBeUndefined()
    expect(released.x).toBeCloseTo(5, 3)
  })

  it('sem ponto de entrega, só apoia a carga', () => {
    const released = releaseCargo(hooked, hookAt(5, G0, 10), SIZE, FLAT, null, null)
    expect(released.result).toBe('none')
  })

  it('a carga engatada acompanha o gancho: posição e giro no mundo', () => {
    const turned = engageCargo(START, hookAt(10, G0, 0, 0), SIZE)
    // O gancho gira 90° e sobe: a posição relativa gira junto.
    const moved = releaseCargo(
      engageCargo(START, hookAt(10.5, G0, 0), SIZE),
      hookAt(20, G0, 5, 90),
      SIZE,
      FLAT,
      null,
      null,
    )
    expect(turned.hooked?.yawDeg).toBe(0)
    // Deslocamento relativo (-0,5; 0) girado 90° em torno de Y vira (0; 0,5).
    expect(moved.x).toBeCloseTo(20, 3)
    expect(moved.z).toBeCloseTo(5.5, 3)
    expect(moved.rotationYDeg).toBeCloseTo(90, 3)
  })

  it('engatar de novo limpa o resultado anterior', () => {
    const released = releaseCargo(hooked, hookAt(5, G0, 10), SIZE, FLAT, DELIVERY, 10_000)
    expect(clearResult(released).result).toBe('none')
  })
})

describe('situação para a interface', () => {
  it('no chão, informa a folga e o alinhamento; no gancho, a altura e a distância à entrega', () => {
    const onGround = cargoStatusOf(START, hookAt(10.3, G0 + 0.4, 0), SIZE, FLAT, DELIVERY)
    expect(onGround).toMatchObject({ active: true, canEngage: true, canRelease: false })
    expect(onGround.gapM).toBeCloseTo(DROP + 0.4, 6)
    expect(onGround.slingDropM).toBeCloseTo(DROP, 9)

    const hooked = engageCargo(START, hookAt(10, G0, 0), SIZE)
    const status = cargoStatusOf(hooked, hookAt(10, G0, 0), SIZE, FLAT, DELIVERY)
    expect(status.canEngage).toBe(false)
    expect(status.heightAboveGroundM).toBeCloseTo(0, 3)
    expect(status.canRelease).toBe(true)
    expect(status.distanceToDeliveryM).toBeCloseTo(Math.hypot(10, 10), 3)
  })
})
