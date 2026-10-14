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

describe('barracão aberto', () => {
  const shed = findLibraryObject('barracao-aberto')!
  const boxes = (scale = { widthM: 14, depthM: 18, heightM: 8.8 }) =>
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

  it('deixa passar pela porta da frente (+Z) e barra nas paredes, no fundo e no teto', () => {
    // Pelo meio da porta, de fora até o fundo da planta (a 2 m de altura): livre.
    expect(crosses([0, 2, 14], [0, 2, -6])).toBe(false)
    // Mesma altura, mas pelo pilar ao lado da porta, e pela parede lateral e pelo fundo.
    expect(crosses([5.5, 2, 14], [5.5, 2, 4])).toBe(true)
    expect(crosses([-12, 2, 0], [0, 2, 0])).toBe(true)
    expect(crosses([0, 2, 0], [0, 2, -14])).toBe(true)
    // Por cima da porta, na altura da verga, e de cima para baixo pelo telhado.
    expect(crosses([0, 6.5, 14], [0, 6.5, 6])).toBe(true)
    expect(crosses([0, 14, 0], [0, 1, 0])).toBe(true)
    // Uma carga de 3 × 3 × 3 m entra pela porta: nenhuma caixa a toca.
    const load = obbFromFrame(
      IDENTITY_TRANSFORM,
      { x: 0, y: 2.5, z: 0 },
      { x: 1.5, y: 1.5, z: 1.5 },
    )
    expect(boxes().every((obb) => obbPenetration(load, obb) === 0)).toBe(true)
    // Mas não passa de lado (a porta tem 8 m de largura; a carga está sobre o pilar).
    const beside = obbFromFrame(
      IDENTITY_TRANSFORM,
      { x: 5.2, y: 2.5, z: 8.8 },
      { x: 1.5, y: 1.5, z: 1.5 },
    )
    expect(boxes().some((obb) => obbPenetration(beside, obb) > 0)).toBe(true)
  })

  it('a abertura cresce e diminui com a escala do obstáculo', () => {
    const half = scaledCollisionBoxes({ widthM: 28, depthM: 18, heightM: 8.8 }, shed)
    const original = scaledCollisionBoxes({ widthM: 14, depthM: 18, heightM: 8.8 }, shed)
    expect(half.length).toBe(original.length)
    expect(half[0]!.w).toBeCloseTo(original[0]!.w * 2)
    expect(half[0]!.d).toBeCloseTo(original[0]!.d)
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
