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

// Dados FICTÍCIOS: carga de 4 m × 2 m × 1,5 m sobre o plano, em (10, 0).
const SIZE = { lengthM: 4, widthM: 2, heightM: 1.5 }
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
  it('liga com o fim do gancho até 0,5 m acima do topo e alinhado a 0,5 m', () => {
    // Topo em 1,5 m; o fim do gancho (G − 1) fica em 1,9 m: 0,4 m acima.
    const check = checkEngage(hookAt(10.3, 2.9, 0), START, SIZE, FLAT)
    expect(check.gapM).toBeCloseTo(0.4, 6)
    expect(check.offsetM).toBeCloseTo(0.3, 6)
    expect(check.canEngage).toBe(true)
  })

  it('não liga alto demais, desalinhado ou enterrado na carga', () => {
    expect(checkEngage(hookAt(10, 3.2, 0), START, SIZE, FLAT).canEngage).toBe(false)
    expect(checkEngage(hookAt(10.8, 2.7, 0), START, SIZE, FLAT).canEngage).toBe(false)
    expect(checkEngage(hookAt(10, 2.0, 0), START, SIZE, FLAT).canEngage).toBe(false)
  })

  it('conta a cadeia de acessórios abaixo do gancho', () => {
    const hook = { ...hookAt(10, 4.9, 0), accessoriesDropM: 2 }
    // Fim da cadeia em 4,9 − 1 − 2 = 1,9 m: 0,4 m acima do topo.
    expect(checkEngage(hook, START, SIZE, FLAT).gapM).toBeCloseTo(0.4, 6)
    expect(checkEngage(hook, START, SIZE, FLAT).canEngage).toBe(true)
  })

  it('assenta a carga no ponto mais alto do terreno sob a pegada', () => {
    const slope: TerrainSpec = { slopeXPercent: 10, slopeZPercent: 0, features: [] }
    const base = cargoBaseY(slope, SIZE, { x: 10, z: 0, rotationYDeg: 0 })
    // Largura 2 m ao longo de X: a borda de +X está em x = 11 → 1,1 m.
    expect(base).toBeCloseTo(1.1, 6)
  })

  it('guarda o deslocamento e usa a distância ao topo como altura das lingas', () => {
    const hooked = engageCargo(START, hookAt(10.3, 2.9, 0), SIZE, FLAT)
    expect(hooked.phase).toBe('hooked')
    expect(hooked.hooked?.offsetX).toBeCloseTo(-0.3, 6)
    expect(hooked.hooked?.offsetZ).toBeCloseTo(0, 6)
    expect(hooked.hooked?.slingDropM).toBeCloseTo(0.4, 6)
  })

  it('guarda o giro em relação ao referencial do gancho', () => {
    const turned = initialCargoState({ x: 10, z: 0, rotationYDeg: 90 })
    const hooked = engageCargo(turned, hookAt(10, 2.9, 0, 30), SIZE, FLAT)
    expect(hooked.hooked?.yawDeg).toBeCloseTo(60, 6)
  })
})

describe('soltar e entregar', () => {
  const hooked = engageCargo(START, hookAt(10, 2.9, 0), SIZE, FLAT)

  it('só solta com a base a até 0,2 m do chão', () => {
    // Base = G − 1 − 0,4 (lingas) − 1,5 (altura) = G − 2,9.
    expect(checkRelease(hookAt(10, 5, 0), hooked.hooked!, SIZE, FLAT).canRelease).toBe(false)
    const near = checkRelease(hookAt(10, 3.0, 0), hooked.hooked!, SIZE, FLAT)
    expect(near.heightAboveGroundM).toBeCloseTo(0.1, 6)
    expect(near.canRelease).toBe(true)
  })

  it('dentro do raio, marca entregue com o tempo da operação', () => {
    const released = releaseCargo(hooked, hookAt(0.5, 2.9, 10), SIZE, FLAT, DELIVERY, 42_300)
    expect(released.phase).toBe('ground')
    expect(released.result).toBe('delivered')
    expect(released.elapsedMs).toBe(42_300)
    expect(released.x).toBeCloseTo(0.5, 3)
    expect(released.z).toBeCloseTo(10, 3)
  })

  it('fora do raio, a carga fica onde caiu e o resultado é "fora"', () => {
    const released = releaseCargo(hooked, hookAt(5, 2.9, 10), SIZE, FLAT, DELIVERY, 10_000)
    expect(released.result).toBe('outside')
    expect(released.elapsedMs).toBeUndefined()
    expect(released.x).toBeCloseTo(5, 3)
  })

  it('sem ponto de entrega, só apoia a carga', () => {
    const released = releaseCargo(hooked, hookAt(5, 2.9, 10), SIZE, FLAT, null, null)
    expect(released.result).toBe('none')
  })

  it('a carga engatada acompanha o gancho: posição e giro no mundo', () => {
    const turned = engageCargo(START, hookAt(10, 2.9, 0, 0), SIZE, FLAT)
    // O gancho gira 90° e sobe: a posição relativa gira junto.
    const moved = releaseCargo(
      engageCargo(START, hookAt(10.5, 2.9, 0), SIZE, FLAT),
      hookAt(20, 2.9, 5, 90),
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
    const released = releaseCargo(hooked, hookAt(5, 2.9, 10), SIZE, FLAT, DELIVERY, 10_000)
    expect(clearResult(released).result).toBe('none')
  })
})

describe('situação para a interface', () => {
  it('no chão, informa a folga e o alinhamento; no gancho, a altura e a distância à entrega', () => {
    const onGround = cargoStatusOf(START, hookAt(10.3, 2.9, 0), SIZE, FLAT, DELIVERY)
    expect(onGround).toMatchObject({ active: true, canEngage: true, canRelease: false })
    expect(onGround.gapM).toBeCloseTo(0.4, 6)

    const hooked = engageCargo(START, hookAt(10, 2.9, 0), SIZE, FLAT)
    const status = cargoStatusOf(hooked, hookAt(10, 2.9, 0), SIZE, FLAT, DELIVERY)
    expect(status.canEngage).toBe(false)
    expect(status.heightAboveGroundM).toBeCloseTo(0, 6)
    expect(status.canRelease).toBe(true)
    expect(status.distanceToDeliveryM).toBeCloseTo(Math.hypot(10, 10), 3)
  })
})
