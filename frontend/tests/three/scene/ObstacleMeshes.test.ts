// Objetos da biblioteca na cena (TASK-072; ADR-036): GLB no lugar da caixa, na escala do obstáculo,
// assentado no terreno, com o modelo compartilhado entre as cópias. Carregador falso (sem rede).

import { BoxGeometry, Group, Mesh, MeshBasicMaterial, type Object3D } from 'three'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Obstacle } from '../../../src/domain/environment/environment'
import { findLibraryObject, newModelObstacle } from '../../../src/domain/environment/objectLibrary'
import {
  MODEL_SELECTION_OUTLINE,
  MODEL_VISUAL,
  OBSTACLE_NAMES,
  ObstacleMeshes,
} from '../../../src/three/scene/ObstacleMeshes'
import { ObjectModelCache } from '../../../src/three/scene/ObjectModels'

const SEDAN = findLibraryObject('sedan')!
const flat = () => 0

function model(overrides: Partial<Obstacle> = {}): Obstacle {
  return {
    ...newModelObstacle(SEDAN, 'sedan-1', 'Carro FICTÍCIO'),
    centerX: 5,
    centerZ: -3,
    ...overrides,
  }
}

function fakeScene(): Object3D {
  const scene = new Group()
  scene.add(new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial()))
  return scene
}

function setup() {
  const loader = vi.fn(async () => fakeScene())
  const cache = new ObjectModelCache(loader)
  const meshes = new ObstacleMeshes(cache)
  const onChange = vi.fn()
  meshes.setOnChange(onChange)
  return { loader, cache, meshes, onChange }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('ObstacleMeshes com objetos da biblioteca', () => {
  let ctx: ReturnType<typeof setup>
  beforeEach(() => {
    ctx = setup()
  })

  it('põe um bloco de espera até o arquivo carregar e depois o modelo, avisando a cena', async () => {
    ctx.meshes.setObstacles([model()], flat)
    const group = ctx.meshes.root.getObjectByName(`${OBSTACLE_NAMES.prefix}sedan-1`)!
    const visual = group.getObjectByName(MODEL_VISUAL)!
    expect(visual.children).toHaveLength(1)
    expect((visual.children[0] as Mesh).material).toBeInstanceOf(MeshBasicMaterial)
    expect((visual.children[0] as Mesh).material).toHaveProperty('transparent', true)

    await flush()
    expect(ctx.onChange).toHaveBeenCalledTimes(1)
    expect(visual.children).toHaveLength(1)
    expect(visual.children[0]!.name).toBe(`objeto-${SEDAN.id}`)
  })

  it('assenta a base no terreno, gira e escala pelo tamanho do obstáculo', async () => {
    const heightAt = (x: number) => 0.1 * x
    ctx.meshes.setObstacles(
      [
        model({
          rotationYDeg: 90,
          widthM: SEDAN.baseSize.w * 2,
          depthM: SEDAN.baseSize.d,
          heightM: SEDAN.baseSize.h * 0.5,
        }),
      ],
      heightAt,
    )
    await flush()
    const group = ctx.meshes.root.children[0]!
    expect(group.position.x).toBe(5)
    expect(group.position.z).toBe(-3)
    // O grupo fica na base (y = 0 do modelo): é o objeto que assenta no terreno.
    expect(group.position.y).toBeCloseTo(0.5)
    expect(group.rotation.y).toBeCloseTo(Math.PI / 2)
    const visual = group.getObjectByName(MODEL_VISUAL)!
    expect(visual.scale.x).toBeCloseTo(2)
    expect(visual.scale.y).toBeCloseTo(0.5)
    expect(visual.scale.z).toBeCloseTo(1)
  })

  it('carrega o arquivo uma vez só e dá cópias que dividem geometria e material', async () => {
    ctx.meshes.setObstacles([model(), model({ id: 'sedan-2', centerX: 9 })], flat)
    await flush()
    expect(ctx.loader).toHaveBeenCalledTimes(1)
    const meshesOf = (group: Object3D) => {
      const found: Mesh[] = []
      group.traverse((object) => {
        if (object instanceof Mesh) found.push(object)
      })
      return found
    }
    const [a, b] = ctx.meshes.root.children.map(
      (group) => meshesOf(group.getObjectByName(MODEL_VISUAL)!)[0]!,
    )
    expect(a).not.toBe(b)
    expect(a!.geometry).toBe(b!.geometry)
    expect(a!.castShadow).toBe(true)
  })

  it('refazer a lista não libera o que as cópias compartilham', async () => {
    ctx.meshes.setObstacles([model()], flat)
    await flush()
    const shared = ctx.cache.peek(SEDAN.id)!
    let geometry: BoxGeometry | undefined
    shared.traverse((object) => {
      if (object instanceof Mesh) geometry = object.geometry as BoxGeometry
    })
    const dispose = vi.spyOn(geometry!, 'dispose')
    ctx.meshes.setObstacles([], flat)
    expect(dispose).not.toHaveBeenCalled()
    expect(ctx.meshes.count).toBe(0)
  })

  it('ignora o arquivo que chega depois de a lista ser refeita', async () => {
    ctx.meshes.setObstacles([model()], flat)
    ctx.meshes.setObstacles([], flat)
    await flush()
    expect(ctx.meshes.count).toBe(0)
    expect(ctx.onChange).not.toHaveBeenCalled()
  })

  it('tem o contorno de seleção, escondido', () => {
    ctx.meshes.setObstacles([model()], flat)
    const outline = ctx.meshes.root.children[0]!.getObjectByName(MODEL_SELECTION_OUTLINE)!
    expect(outline.visible).toBe(false)
  })

  it('arquivo que não carrega deixa o bloco de espera, sem erro', async () => {
    const failing = new ObjectModelCache(async () => {
      throw new Error('404')
    })
    const meshes = new ObstacleMeshes(failing)
    meshes.setObstacles([model()], flat)
    await flush()
    expect(meshes.count).toBe(1)
    expect(failing.hasFailed(SEDAN.id)).toBe(true)
    // Segunda vez: já sabe que falhou e nem tenta de novo.
    meshes.setObstacles([model()], flat)
    await flush()
    expect(meshes.count).toBe(1)
  })

  it('modelId desconhecido volta a ser uma caixa', () => {
    ctx.meshes.setObstacles([model({ modelId: 'fora-da-biblioteca' })], flat)
    const group = ctx.meshes.root.children[0]!
    expect(group.userData.kind).toBeUndefined()
    expect(group.children[0]).toBeInstanceOf(Mesh)
    expect(ctx.loader).not.toHaveBeenCalled()
  })
})
