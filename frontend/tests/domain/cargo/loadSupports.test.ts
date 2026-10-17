// Entrega sobre contêiner, carreta prancha e qualquer objeto com superfície de apoio (TASK-108;
// ADR-052). Dados FICTÍCIOS de cena; as medidas dos contêineres são as da ISO 668.

import { describe, expect, it } from 'vitest'

import { followLoadBed } from '../../../src/domain/cargo/cargoFollow'
import {
  bedStatusAt,
  cargoBaseY,
  cargoStatusOf,
  cargoSupport,
  type HookReference,
  initialCargoState,
} from '../../../src/domain/cargo/cargoOperation'
import { exceedsCapacity, loadBedsOf, loadBedUnder } from '../../../src/domain/cargo/loadBeds'
import { rotY } from '../../../src/domain/collision/obb'
import {
  EMPTY_SCENARIO,
  type Obstacle,
  type TerrainSpec,
} from '../../../src/domain/environment/environment'
import {
  findLibraryObject,
  NO_CAPACITY_SOURCE,
  newModelObstacle,
  OBJECT_LIBRARY,
} from '../../../src/domain/environment/objectLibrary'
import { bedNote, cargoGuidance } from '../../../src/application/cargo/cargoGuidance'

const FLAT: TerrainSpec = EMPTY_SCENARIO.terrain
const SIZE = { lengthM: 2, widthM: 2, heightM: 1 }

function placed(modelId: string, patch: Partial<Obstacle> = {}): Obstacle {
  const object = findLibraryObject(modelId)
  if (!object) throw new Error(`sem ${modelId}`)
  return {
    ...newModelObstacle(object, `obs-${modelId}`, modelId),
    centerX: 0,
    centerZ: 0,
    ...patch,
  }
}

describe('contêineres ISO e carreta prancha na biblioteca', () => {
  it('entram no cenário com a medida ISO 668 (20 e 40 pés, 8,5 e 9,5 pés de altura)', () => {
    const size = (id: string) => {
      const o = placed(id)
      return [o.widthM, o.depthM, o.heightM]
    }
    expect(size('conteiner-20')).toEqual([2.438, 6.058, 2.591])
    expect(size('conteiner-40')).toEqual([2.438, 12.192, 2.591])
    expect(size('conteiner-40hc')).toEqual([2.438, 12.192, 2.896])
    expect(size('carreta-prancha')).toEqual([2.6, 13, 1.5])
    // O contêiner genérico segue com a medida do modelo (cenários antigos não mudam).
    expect(size('conteiner')).toEqual([2.72, 6, 2.54])
  })

  it('todos declaram a superfície de apoio, e sem dado de capacidade ela é FICTÍCIA', () => {
    for (const id of [
      'caminhao-plataforma',
      'carreta-prancha',
      'conteiner',
      'conteiner-20',
      'conteiner-40',
      'conteiner-40hc',
    ]) {
      const object = findLibraryObject(id)!
      expect(object.loadBed, id).toBeDefined()
      expect(object.loadBedInfo?.source, id).toBe(NO_CAPACITY_SOURCE)
      expect(object.loadBedInfo?.capacityKg, id).toBeUndefined()
    }
  })

  it('objeto sem loadBed (caminhão baú, sedan, árvore) continua sem receber carga', () => {
    const withBed = OBJECT_LIBRARY.filter((object) => object.loadBed !== undefined).map((o) => o.id)
    expect(withBed.sort()).toEqual(
      [
        'caminhao-plataforma',
        'carreta-prancha',
        'conteiner',
        'conteiner-20',
        'conteiner-40',
        'conteiner-40hc',
      ].sort(),
    )
  })
})

describe('apoio sobre o contêiner e a prancha (centro da pegada)', () => {
  it('o topo do contêiner (2,591 m) e do convés da prancha (1,5 m) são a altura de apoio', () => {
    const container = placed('conteiner-20')
    const flatbed = placed('carreta-prancha', { centerX: 20 })
    const beds = loadBedsOf([container, flatbed], FLAT)
    expect(beds.map((bed) => bed.modelId)).toEqual(['conteiner-20', 'carreta-prancha'])
    expect(beds[0]?.topY).toBeCloseTo(2.591, 6)
    expect(beds[1]?.topY).toBeCloseTo(1.5, 6)
    expect(
      cargoBaseY(FLAT, SIZE, { x: 0, z: 0, rotationYDeg: 0 }, [container, flatbed]),
    ).toBeCloseTo(2.591, 6)
    expect(
      cargoBaseY(FLAT, SIZE, { x: 20, z: 5, rotationYDeg: 0 }, [container, flatbed]),
    ).toBeCloseTo(1.5, 6)
  })

  it('o contêiner de 40 pés high cube tem o teto a 2,896 m', () => {
    const hc = placed('conteiner-40hc')
    expect(cargoBaseY(FLAT, SIZE, { x: 0, z: 4, rotationYDeg: 0 }, [hc])).toBeCloseTo(2.896, 6)
  })

  it('só o centro decide: com o centro fora do teto a carga assenta no terreno', () => {
    const container = placed('conteiner-20') // vai de z = −3,029 a 3,029
    const inside = { x: 0, z: 3, rotationYDeg: 0 }
    const outside = { x: 0, z: 3.05, rotationYDeg: 0 }
    expect(cargoSupport(FLAT, SIZE, inside, [container]).onBed).toBe(true)
    expect(cargoSupport(FLAT, SIZE, outside, [container])).toEqual({ baseY: 0, onBed: false })
  })

  it('o contêiner girado 90° apoia pelo retângulo girado', () => {
    const container = placed('conteiner-40', { rotationYDeg: 90 }) // comprimento passa para X
    expect(cargoSupport(FLAT, SIZE, { x: 5, z: 0, rotationYDeg: 0 }, [container]).onBed).toBe(true)
    expect(cargoSupport(FLAT, SIZE, { x: 0, z: 5, rotationYDeg: 0 }, [container]).onBed).toBe(false)
  })

  it('o terreno mais alto vale quando passa do topo (a carga não afunda)', () => {
    const slope: TerrainSpec = { ...FLAT, slopeXPercent: 0, slopeZPercent: 0 }
    const container = placed('conteiner-20')
    expect(loadBedUnder({ x: 0, z: 0 }, loadBedsOf([container], slope))?.topY).toBeCloseTo(2.591, 6)
  })

  it('o contêiner mais alto vence quando dois se sobrepõem sob o centro', () => {
    const low = placed('conteiner-40', { id: 'baixo' })
    const high = placed('conteiner-40hc', { id: 'alto' })
    const bed = loadBedUnder({ x: 0, z: 0 }, loadBedsOf([low, high], FLAT))
    expect(bed?.obstacleId).toBe('alto')
  })
})

describe('a carga solta sobre o contêiner ou a prancha acompanha o objeto movido', () => {
  const start = initialCargoState({ x: 0, z: 4, rotationYDeg: 10 })

  it('contêiner de 40 pés movido e girado leva a carga, com a altura recalculada', () => {
    const before = [placed('conteiner-40')]
    const after = [placed('conteiner-40', { centerX: 10, centerZ: 2, rotationYDeg: 90 })]
    const next = followLoadBed(start, before, after, FLAT)
    // 4 m à frente (+Z) do centro; com 90° a frente passa a +X.
    expect(next.x).toBeCloseTo(14, 6)
    expect(next.z).toBeCloseTo(2, 6)
    expect(next.rotationYDeg).toBe(100)
    expect(cargoBaseY(FLAT, SIZE, next, after)).toBeCloseTo(2.591, 6)
  })

  it('a prancha movida leva a carga; trocada por outro modelo, a carga fica e assenta no terreno', () => {
    const before = [placed('carreta-prancha')]
    const state = initialCargoState({ x: 0, z: -3, rotationYDeg: 0 })
    const moved = followLoadBed(state, before, [placed('carreta-prancha', { centerX: -8 })], FLAT)
    expect(moved.x).toBeCloseTo(-8, 6)
    const swapped = [placed('carreta-prancha', { id: before[0]!.id, modelId: 'caminhao-bau' })]
    expect(followLoadBed(state, before, swapped, FLAT)).toBe(state)
    expect(cargoBaseY(FLAT, SIZE, state, swapped)).toBe(0)
  })

  it('trocar o contêiner de 20 por 40 pés (outro modelo) não leva a carga', () => {
    const before = [placed('conteiner-20')]
    const state = initialCargoState({ x: 0, z: 2, rotationYDeg: 0 })
    const after = [placed('conteiner-40', { id: before[0]!.id })]
    expect(followLoadBed(state, before, after, FLAT)).toBe(state)
  })
})

describe('capacidade do apoio: confere se há dado, rotula FICTÍCIO se não há', () => {
  const hook: HookReference = {
    frame: { rot: rotY(0), pos: { x: 30, y: 4, z: 0 } },
    yawDeg: 0,
    attachOffsetM: 1,
    accessoriesDropM: 0,
  }
  const hooked = {
    ...initialCargoState({ x: 30, z: 0, rotationYDeg: 0 }),
    phase: 'hooked' as const,
    hooked: { offsetX: 0, offsetZ: 0, yawDeg: 0, slingDropM: 0.4 },
  }

  it('sem capacidade conhecida o apoio é FICTÍCIO e o peso não limita', () => {
    const container = placed('conteiner-20', { centerX: 30 })
    const bed = loadBedsOf([container], FLAT)[0]!
    expect(bed.capacityKg).toBeUndefined()
    expect(bed.capacitySource).toBe(NO_CAPACITY_SOURCE)
    expect(exceedsCapacity(bed, 1e9)).toBe(false)
    const status = cargoStatusOf(hooked, hook, SIZE, FLAT, null, [container])
    expect(status.bed).toEqual({
      label: "Contêiner 20' (ISO)",
      capacityKg: null,
      source: NO_CAPACITY_SOURCE,
    })
    const note = bedNote(status, 50_000)
    expect(note?.text).toContain('Apoio FICTÍCIO')
    expect(note?.warning).toBe(false)
  })

  it('com capacidade conhecida, peso acima dela vira aviso e dentro dela é só informação', () => {
    const bed = { label: 'Apoio de teste', capacityKg: 5_000, source: 'FICTÍCIO (teste)' }
    const base = cargoStatusOf(hooked, hook, SIZE, FLAT, null, [])
    const status = { ...base, bed }
    expect(bedNote(status, 6_000)).toEqual({
      text: ' Atenção: Apoio de teste suporta no máximo 5.000 kg e a carga pesa 6.000 kg.',
      warning: true,
    })
    expect(bedNote(status, 4_000)?.warning).toBe(false)
    expect(bedNote(status)?.text).toContain('capacidade de 5.000 kg')
    expect(bedNote(base, 6_000)).toBeNull() // sobre o terreno não há apoio
  })

  it('as dicas da soltura levam o aviso de peso e o rótulo FICTÍCIO', () => {
    const container = placed('conteiner-20', { centerX: 30 })
    const status = {
      ...cargoStatusOf(hooked, hook, SIZE, FLAT, null, [container]),
      active: true,
      canRelease: true,
    }
    const guidance = cargoGuidance({ status, cargoPlaced: true, deliveryPlaced: true })
    expect(guidance.message).toContain('Toque em Soltar')
    expect(guidance.message).toContain('Apoio FICTÍCIO')
    const heavy = cargoGuidance({
      status: { ...status, bed: { label: 'Apoio de teste', capacityKg: 100, source: 'x' } },
      cargoPlaced: true,
      deliveryPlaced: true,
      loadWeightKg: 500,
    })
    expect(heavy.tone).toBe('warning')
    expect(heavy.message).toContain('suporta no máximo 100 kg')
  })

  it('bedStatusAt é nulo sobre o terreno e descreve o apoio sob o ponto', () => {
    const container = placed('conteiner-40')
    expect(bedStatusAt({ x: 50, z: 50 }, FLAT, [container])).toBeNull()
    expect(bedStatusAt({ x: 0, z: 0 }, FLAT, [container])?.label).toBe("Contêiner 40' (ISO)")
  })
})
