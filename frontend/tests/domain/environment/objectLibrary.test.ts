// Biblioteca de objetos do editor 3D (TASK-072; ADR-036): catálogo, escala real e caixas de colisão.
// Confere cada GLB de public/models contra o `baseSize` da biblioteca.

import { resolve } from 'node:path'

import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { getBounds } from '@gltf-transform/functions'
import { describe, expect, it } from 'vitest'

import {
  obbPenetration,
  obbFromFrame,
  segmentIntersectsObb,
} from '../../../src/domain/collision/obb'
import { IDENTITY_TRANSFORM } from '../../../src/domain/collision/obb'
import {
  findLibraryObject,
  libraryObjectsIn,
  newModelObstacle,
  OBJECT_CATEGORIES,
  OBJECT_LIBRARY,
  scaledCollisionBoxes,
  usedCategories,
} from '../../../src/domain/environment/objectLibrary'

const MODELS_DIR = resolve(__dirname, '../../../public/models')

describe('catálogo', () => {
  it('tem ids únicos, categorias válidas e o que o pedido listava', () => {
    const ids = OBJECT_LIBRARY.map((object) => object.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(OBJECT_LIBRARY.length).toBeGreaterThanOrEqual(15)
    for (const object of OBJECT_LIBRARY) {
      expect(OBJECT_CATEGORIES).toContain(object.category)
      expect(object.collision.length).toBeGreaterThan(0)
    }
    for (const wanted of [
      'barracao-aberto',
      'guindaste-estacionado',
      'conteiner',
      'caminhao',
      'sedan',
      'van',
    ]) {
      expect(findLibraryObject(wanted)).toBeDefined()
    }
    expect(usedCategories()).toEqual(['vegetacao', 'edificacao', 'veiculo', 'guindaste', 'outro'])
    expect(libraryObjectsIn('vegetacao').length).toBeGreaterThanOrEqual(6)
    expect(findLibraryObject('nao-existe')).toBeUndefined()
    expect(findLibraryObject(undefined)).toBeUndefined()
  })

  it('usa tamanhos reais em metros', () => {
    const size = (id: string) => findLibraryObject(id)!.baseSize
    for (const tree of ['arvore-carvalho', 'pinheiro', 'arvore-copa-redonda', 'palmeira']) {
      expect(size(tree).h).toBeGreaterThanOrEqual(6)
      expect(size(tree).h).toBeLessThanOrEqual(10)
    }
    expect(size('casa-terrea').w).toBeGreaterThan(6)
    expect(size('casa-terrea').w).toBeLessThan(9)
    expect(size('barracao-aberto').h).toBeGreaterThanOrEqual(8)
    expect(size('galpao-fechado').h).toBeGreaterThanOrEqual(8)
    expect(size('caminhao').d).toBeGreaterThan(7)
    expect(size('caminhao').d).toBeLessThan(9)
    expect(size('sedan').d).toBeGreaterThan(4)
    expect(size('sedan').d).toBeLessThan(5)
  })

  it('as caixas de colisão ficam dentro do tamanho do modelo', () => {
    for (const object of OBJECT_LIBRARY) {
      const { w, d, h } = object.baseSize
      for (const box of object.collision) {
        expect(box.y, object.id).toBeGreaterThanOrEqual(0)
        expect(box.y + box.h, object.id).toBeLessThanOrEqual(h + 0.02)
        expect(Math.abs(box.x) + box.w / 2, object.id).toBeLessThanOrEqual(w / 2 + 0.02)
        expect(Math.abs(box.z) + box.d / 2, object.id).toBeLessThanOrEqual(d / 2 + 0.02)
      }
    }
  })
})

describe('arquivos GLB', () => {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)

  it.each(OBJECT_LIBRARY.map((object) => [object.id, object] as const))(
    '%s existe e tem o tamanho da biblioteca',
    async (_id, object) => {
      const doc = await io.read(resolve(MODELS_DIR, object.file))
      const scene = doc.getRoot().listScenes()[0]!
      const bounds = getBounds(scene)
      const tolerance = 0.06
      expect(bounds.max[0] - bounds.min[0]).toBeCloseTo(object.baseSize.w, 1)
      expect(bounds.max[2] - bounds.min[2]).toBeCloseTo(object.baseSize.d, 1)
      expect(Math.abs(bounds.max[1] - bounds.min[1] - object.baseSize.h)).toBeLessThan(tolerance)
      if (object.modelOffset === undefined) {
        // Gerados já centrados na planta e com a base em y = 0.
        expect(Math.abs(bounds.min[1])).toBeLessThan(tolerance)
        expect(Math.abs((bounds.min[0] + bounds.max[0]) / 2)).toBeLessThan(tolerance)
        expect(Math.abs((bounds.min[2] + bounds.max[2]) / 2)).toBeLessThan(tolerance)
      } else {
        // O GLB do guindaste fica como está; o deslocamento centra a planta ao carregar.
        expect((bounds.min[2] + bounds.max[2]) / 2 + object.modelOffset.z).toBeCloseTo(0, 1)
      }
    },
  )
})

describe('galpão com frente aberta', () => {
  const shed = findLibraryObject('barracao-aberto')!
  const boxes = (scale = { widthM: 19.22, depthM: 27.44, heightM: 8.27 }) =>
    scaledCollisionBoxes(scale, shed).map((box) =>
      obbFromFrame(
        IDENTITY_TRANSFORM,
        { x: box.x, y: box.y + box.h / 2, z: box.z },
        { x: box.w / 2, y: box.h / 2, z: box.d / 2 },
      ),
    )
  const crosses = (from: [number, number, number], to: [number, number, number]) =>
    boxes().some((obb) =>
      segmentIntersectsObb(
        { x: from[0], y: from[1], z: from[2] },
        { x: to[0], y: to[1], z: to[2] },
        obb,
      ),
    )

  it('é o hangar de 8 m: arco de 16,4 m de largura, aberto em +Z e fechado no fundo', () => {
    expect(shed.label).toBe('Galpão com frente aberta')
    expect(shed.file).toBe('objetos/barracao-aberto.glb')
    expect(shed.baseSize.h).toBeGreaterThanOrEqual(8)
    expect(shed.baseSize.h).toBeLessThanOrEqual(10)
  })

  it('deixa passar pela abertura da frente (+Z) e barra nas paredes, no fundo e no teto', () => {
    // Pelo meio, de fora até o fundo da planta (a 2 m de altura): livre.
    expect(crosses([0, 2, 16], [0, 2, -10])).toBe(false)
    // Pelo arco, a 6 m de altura e a 3 m do eixo, ainda dentro do túnel.
    expect(crosses([3, 6, 16], [3, 6, -10])).toBe(false)
    // Pela parede lateral (a 8,2 m do eixo), pelo fundo (z = -11,76) e por cima do arco.
    expect(crosses([-12, 2, 0], [0, 2, 0])).toBe(true)
    expect(crosses([12, 2, 0], [0, 2, 0])).toBe(true)
    expect(crosses([0, 2, 0], [0, 2, -14])).toBe(true)
    expect(crosses([0, 14, 0], [0, 1, 0])).toBe(true)
    // Perto da parede o arco desce: a 7,5 m do eixo, a 2,9 m de altura, já está dentro da casca.
    expect(crosses([7.5, 2.9, 16], [7.5, 2.9, 0])).toBe(true)
    // Uma carga de 3 × 3 × 3 m entra pela abertura: nenhuma caixa a toca.
    const load = obbFromFrame(
      IDENTITY_TRANSFORM,
      { x: 0, y: 2.5, z: 0 },
      { x: 1.5, y: 1.5, z: 1.5 },
    )
    expect(boxes().every((obb) => obbPenetration(load, obb) === 0)).toBe(true)
    // Mas não atravessa a parede lateral.
    const inWall = obbFromFrame(
      IDENTITY_TRANSFORM,
      { x: 8.1, y: 1.5, z: 0 },
      { x: 1.5, y: 1.5, z: 1.5 },
    )
    expect(boxes().some((obb) => obbPenetration(inWall, obb) > 0)).toBe(true)
  })

  it('as caixas seguem o arco do GLB: semicírculo de 8,2 m de raio', () => {
    const list = scaledCollisionBoxes({ widthM: 19.22, depthM: 27.44, heightM: 8.27 }, shed)
    const top = Math.max(...list.map((box) => box.y + box.h))
    expect(top).toBeGreaterThan(8)
    expect(top).toBeLessThanOrEqual(8.27)
    const widest = Math.max(...list.map((box) => Math.abs(box.x) + box.w / 2))
    expect(widest).toBeCloseTo(8.2, 1)
    // O fundo (-Z) fecha o arco; a frente (+Z) fica sem caixa nenhuma.
    expect(list.some((box) => box.z < -11 && box.d < 0.5)).toBe(true)
    expect(list.every((box) => box.z + box.d / 2 <= 11.77)).toBe(true)
  })

  it('a abertura cresce e diminui com a escala do obstáculo', () => {
    const wide = scaledCollisionBoxes({ widthM: 38.44, depthM: 27.44, heightM: 8.27 }, shed)
    const original = scaledCollisionBoxes({ widthM: 19.22, depthM: 27.44, heightM: 8.27 }, shed)
    expect(wide.length).toBe(original.length)
    expect(wide[0]!.w).toBeCloseTo(original[0]!.w * 2)
    expect(wide[0]!.d).toBeCloseTo(original[0]!.d)
  })
})

describe('novo obstáculo', () => {
  it('nasce em tamanho real, sem giro, do tipo model', () => {
    const sedan = findLibraryObject('sedan')!
    expect(newModelObstacle(sedan, 'sedan-1', 'Carro (sedã)')).toEqual({
      id: 'sedan-1',
      label: 'Carro (sedã)',
      kind: 'model',
      modelId: 'sedan',
      widthM: sedan.baseSize.w,
      depthM: sedan.baseSize.d,
      heightM: sedan.baseSize.h,
      rotationYDeg: 0,
    })
  })
})
