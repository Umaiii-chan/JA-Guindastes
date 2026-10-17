import { describe, expect, it } from 'vitest'

import {
  cargoBaseY,
  cargoSupport,
  cargoStatusOf,
  checkEngage,
  checkRelease,
  engageCargo,
  type HookReference,
  initialCargoState,
  releaseCargo,
} from '../../../src/domain/cargo/cargoOperation'
import { followLoadBed } from '../../../src/domain/cargo/cargoFollow'
import { loadBedsOf, pointInRect } from '../../../src/domain/cargo/loadBeds'
import { rotY } from '../../../src/domain/collision/obb'
import {
  type DeliveryPoint,
  EMPTY_SCENARIO,
  type Obstacle,
  type TerrainSpec,
} from '../../../src/domain/environment/environment'
import { findLibraryObject, newModelObstacle } from '../../../src/domain/environment/objectLibrary'
import { slingDropOf } from '../../../src/domain/rigging/slingGeometry'

// Dados FICTÍCIOS. Caminhão plataforma no centro (0, 0), tamanho real da biblioteca: carroceria na
// metade de trás (z de −3,705 a 0), 4,05 m de largura e topo a 53 % de 3,51 m.
const FLAT: TerrainSpec = EMPTY_SCENARIO.terrain
// A caixa da biblioteca é arredondada ao centímetro: 3,51 × 0,53 = 1,86 m.
const BED_TOP = 1.86
const SIZE = { lengthM: 2, widthM: 2, heightM: 1 }
// F-19: altura das lingas da geometria única (60° com a horizontal).
const DROP = slingDropOf(SIZE.lengthM, SIZE.widthM)
/** G com as lingas esticadas sobre a carga: altura (1) + engate (1) + lingas. */
const G0 = SIZE.heightM + 1 + DROP

function truck(modelId: string, rotationYDeg = 0): Obstacle {
  const object = findLibraryObject(modelId)
  if (!object) throw new Error(`sem ${modelId}`)
  return {
    ...newModelObstacle(object, `obs-${modelId}`, modelId),
    centerX: 0,
    centerZ: 0,
    rotationYDeg,
  }
}

const PLATFORM = truck('caminhao-plataforma')

function hookAt(x: number, y: number, z: number): HookReference {
  return {
    frame: { rot: rotY(0), pos: { x, y, z } },
    yawDeg: 0,
    attachOffsetM: 1,
    accessoriesDropM: 0,
  }
}

const pose = (x: number, z: number, rotationYDeg = 0) => ({ x, z, rotationYDeg })

describe('carroceria do caminhão plataforma como superfície de apoio', () => {
  it('só o caminhão plataforma tem carroceria; outros objetos não recebem carga', () => {
    expect(loadBedsOf([PLATFORM], FLAT)).toHaveLength(1)
    expect(loadBedsOf([truck('caminhao-bau'), truck('caminhao')], FLAT)).toHaveLength(0)
    expect(loadBedsOf([{ ...PLATFORM, kind: 'box', modelId: undefined }], FLAT)).toHaveLength(0)
  })

  it('sobre a carroceria, a base assenta no topo dela', () => {
    expect(cargoBaseY(FLAT, SIZE, pose(0, -1.85), [PLATFORM])).toBeCloseTo(BED_TOP, 6)
  })

  it('ao lado do caminhão, a base fica no chão', () => {
    expect(cargoBaseY(FLAT, SIZE, pose(4, -1.85), [PLATFORM])).toBe(0)
    expect(cargoBaseY(FLAT, SIZE, pose(0, -1.85), [])).toBe(0)
  })

  it('só o centro da pegada decide: fora da carroceria, a base fica no chão (TASK-103)', () => {
    // Carga de z = 0,01 a 2,01 (centro em 1,01): a carroceria termina em z = 0,005.
    expect(cargoBaseY(FLAT, SIZE, pose(0, 1.01), [PLATFORM])).toBe(0)
    // Centro 1 cm além da borda, com a ponta da carga (1 m de meia-pegada) sobre a carroceria.
    expect(cargoBaseY(FLAT, SIZE, pose(0, 0.015), [PLATFORM])).toBe(0)
    expect(cargoBaseY(FLAT, SIZE, pose(2.1, -1.85), [PLATFORM])).toBe(0)
  })

  it('centro dentro da carroceria, com a ponta para fora, a carga se apoia nela', () => {
    // Carga de z = −1,5 a 0,5: o centro (−0,5) está sobre a carroceria, a ponta passa da borda.
    expect(cargoBaseY(FLAT, SIZE, pose(0, -0.5), [PLATFORM])).toBeCloseTo(BED_TOP, 6)
    // Centro 5 mm dentro da borda de trás: ainda apoia.
    expect(cargoBaseY(FLAT, SIZE, pose(0, -0.005), [PLATFORM])).toBeCloseTo(BED_TOP, 6)
    expect(cargoBaseY(FLAT, SIZE, pose(2, -1.85), [PLATFORM])).toBeCloseTo(BED_TOP, 6)
  })

  it('o giro da carga não muda o centro: o critério é o mesmo', () => {
    expect(cargoBaseY(FLAT, SIZE, pose(0, -0.5, 45), [PLATFORM])).toBeCloseTo(BED_TOP, 6)
    expect(cargoBaseY(FLAT, SIZE, pose(0, 0.5, 45), [PLATFORM])).toBe(0)
  })

  it('cargoSupport diz se a carga está na carroceria', () => {
    expect(cargoSupport(FLAT, SIZE, pose(0, -1.85), [PLATFORM])).toEqual({
      baseY: expect.closeTo(BED_TOP, 6),
      onBed: true,
    })
    expect(cargoSupport(FLAT, SIZE, pose(0, 0.5), [PLATFORM])).toEqual({ baseY: 0, onBed: false })
  })

  it('acompanha o giro do caminhão e a altura do terreno sob ele', () => {
    const turned = truck('caminhao-plataforma', 90)
    // Girada 90°, a carroceria passa para x de 0 a 3,705 (rotY: +Z vira +X, então −Z vira −X).
    const beds = loadBedsOf([turned], FLAT)
    const xs = beds[0]!.corners.map((corner) => corner.x)
    expect(Math.min(...xs)).toBeCloseTo(-3.705, 2)
    expect(Math.max(...xs)).toBeCloseTo(0, 1)
    expect(cargoBaseY(FLAT, SIZE, pose(-1.85, 0), [turned])).toBeCloseTo(BED_TOP, 6)
    expect(cargoBaseY(FLAT, SIZE, pose(1.85, 0), [turned])).toBe(0)

    const slope: TerrainSpec = { slopeXPercent: 0, slopeZPercent: 0, features: [] }
    expect(loadBedsOf([PLATFORM], slope)[0]?.topY).toBeCloseTo(BED_TOP, 6)
  })

  it('pointInRect: dentro, na borda e fora', () => {
    const square = [
      { x: 0, z: 0 },
      { x: 2, z: 0 },
      { x: 2, z: 2 },
      { x: 0, z: 2 },
    ]
    expect(pointInRect({ x: 1, z: 1 }, square)).toBe(true)
    expect(pointInRect({ x: 2, z: 1 }, square)).toBe(true)
    expect(pointInRect({ x: 2.01, z: 1 }, square)).toBe(false)
    expect(pointInRect({ x: 1, z: -0.01 }, square)).toBe(false)
  })
})

describe('soltar sobre a carroceria', () => {
  const OBSTACLES = [PLATFORM]
  const DELIVERY: DeliveryPoint = { x: 0, z: -1.85, rotationYDeg: 0, radiusM: 2 }
  // Carga engatada no chão em (10, 0), com as lingas esticadas (gancho a `DROP` acima do topo).
  const start = initialCargoState({ x: 10, z: 0, rotationYDeg: 0 })
  const hooked = engageCargo(start, hookAt(10, G0, 0), SIZE)

  // Base da carga = G − 1 (gancho) − DROP (lingas) − 1 (altura) = G − G0; o gancho segue a carga.
  const hookOver = (baseY: number, x: number, z: number) => hookAt(x + 10, baseY + G0, z)

  it('solta a até 0,2 m do topo da carroceria, não do chão', () => {
    const over = hookOver(BED_TOP + 0.1, -10, -1.85)
    const check = checkRelease(over, hooked.hooked!, SIZE, FLAT, OBSTACLES)
    expect(check.heightAboveGroundM).toBeCloseTo(0.1, 3) // lingas guardadas em milímetros
    expect(check.canRelease).toBe(true)
    // Sem a carroceria no cenário, a mesma posição está acima do chão: não solta.
    expect(checkRelease(over, hooked.hooked!, SIZE, FLAT).canRelease).toBe(false)
  })

  it('alto demais sobre a carroceria não solta', () => {
    const over = hookOver(BED_TOP + 0.5, -10, -1.85)
    expect(checkRelease(over, hooked.hooked!, SIZE, FLAT, OBSTACLES).canRelease).toBe(false)
  })

  it('ao lado do caminhão vale a regra do chão', () => {
    const near = hookOver(0.1, -6, -1.85)
    expect(checkRelease(near, hooked.hooked!, SIZE, FLAT, OBSTACLES).canRelease).toBe(true)
    const high = hookOver(BED_TOP + 0.1, -6, -1.85)
    expect(checkRelease(high, hooked.hooked!, SIZE, FLAT, OBSTACLES).canRelease).toBe(false)
  })

  it('solta e a carga fica apoiada na carroceria, entregue no alvo', () => {
    const over = hookOver(BED_TOP + 0.1, -10, -1.85)
    const status = cargoStatusOf(hooked, over, SIZE, FLAT, DELIVERY, OBSTACLES)
    expect(status.canRelease).toBe(true)
    const released = releaseCargo(hooked, over, SIZE, FLAT, DELIVERY, 1000, OBSTACLES)
    expect(released.phase).toBe('ground')
    expect(released.result).toBe('delivered')
    expect(released.z).toBeCloseTo(-1.85, 3)
    expect(cargoBaseY(FLAT, SIZE, released, OBSTACLES)).toBeCloseTo(BED_TOP, 6)
  })

  it('engatar de novo a carga que está na carroceria conta o topo dela', () => {
    const onBed = initialCargoState({ x: 0, z: -1.85, rotationYDeg: 0 })
    const top = BED_TOP + SIZE.heightM
    // Fim do gancho (G − 1) 0,3 m acima do ponto em que as lingas esticam sobre o topo.
    const check = checkEngage(hookAt(0, top + 1 + DROP + 0.3, -1.85), onBed, SIZE, FLAT, OBSTACLES)
    expect(check.gapM).toBeCloseTo(DROP + 0.3, 6)
    expect(check.canEngage).toBe(true)
    expect(checkEngage(hookAt(0, top + 1 + DROP + 0.3, -1.85), onBed, SIZE, FLAT).canEngage).toBe(
      false,
    )
  })
})

describe('carga sobre a carroceria acompanha o caminhão (TASK-103)', () => {
  const placed = initialCargoState({ x: 0, z: -1.85, rotationYDeg: 10 })
  const moved = (patch: Partial<Obstacle>): Obstacle[] => [{ ...PLATFORM, ...patch }]

  it('mover o caminhão leva a carga junto, com o mesmo giro', () => {
    const next = followLoadBed(placed, [PLATFORM], moved({ centerX: 5, centerZ: 3 }), FLAT)
    expect(next.x).toBeCloseTo(5, 6)
    expect(next.z).toBeCloseTo(1.15, 6)
    expect(next.rotationYDeg).toBe(10)
    expect(cargoBaseY(FLAT, SIZE, next, moved({ centerX: 5, centerZ: 3 }))).toBeCloseTo(BED_TOP, 6)
  })

  it('girar o caminhão gira a carga em torno do centro dele', () => {
    const turned = moved({ rotationYDeg: 90 })
    const next = followLoadBed(placed, [PLATFORM], turned, FLAT)
    // Carga a 1,85 m atrás do centro (−Z): com 90°, o atrás passa a −X.
    expect(next.x).toBeCloseTo(-1.85, 6)
    expect(next.z).toBeCloseTo(0, 6)
    expect(next.rotationYDeg).toBe(100)
    expect(cargoBaseY(FLAT, SIZE, next, turned)).toBeCloseTo(BED_TOP, 6)
  })

  it('o giro dá a volta em ±180°', () => {
    const next = followLoadBed(placed, [PLATFORM], moved({ rotationYDeg: 175 }), FLAT)
    expect(next.rotationYDeg).toBe(-175)
  })

  it('carga ao lado do caminhão, no gancho, ou caminhão sem mudança: o estado não muda', () => {
    const beside = initialCargoState({ x: 6, z: 0, rotationYDeg: 0 })
    expect(followLoadBed(beside, [PLATFORM], moved({ centerX: 5 }), FLAT)).toBe(beside)
    expect(followLoadBed(placed, [PLATFORM], [{ ...PLATFORM }], FLAT)).toBe(placed)
    const hooked = engageCargo(beside, hookAt(6, 2.4, 0), SIZE)
    expect(followLoadBed(hooked, [PLATFORM], moved({ centerX: 5 }), FLAT)).toBe(hooked)
  })

  it('caminhão removido: a carga fica onde está e assenta no terreno', () => {
    const next = followLoadBed(placed, [PLATFORM], [], FLAT)
    expect(next).toBe(placed)
    expect(cargoBaseY(FLAT, SIZE, next, [])).toBe(0)
  })

  it('caminhão trocado por outro modelo sem carroceria: a carga fica e assenta no terreno', () => {
    const baú = { ...truck('caminhao-bau'), id: PLATFORM.id }
    const next = followLoadBed(placed, [PLATFORM], [baú], FLAT)
    expect(next).toBe(placed)
    expect(cargoBaseY(FLAT, SIZE, next, [baú])).toBe(0)
  })

  it('só o caminhão sob a carga a leva; outro caminhão movido não interfere', () => {
    const other = { ...truck('caminhao-plataforma'), id: 'outro', centerX: 30 }
    const after = [PLATFORM, { ...other, centerX: 40 }]
    expect(followLoadBed(placed, [PLATFORM, other], after, FLAT)).toBe(placed)
  })
})
