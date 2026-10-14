// Modelo 3D do tipo de carga na cena (leva F): pendurado (HookLoad) e no chão (GroundCargo), escalado
// para as medidas, no lugar da caixa. Carregador falso (sem rede); dados FICTÍCIOS.

import { BoxGeometry, Group, Mesh, MeshBasicMaterial, type Object3D, Vector3 } from 'three'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { cargoModels } from '../../../src/three/scene/CargoModels'
import { GROUND_CARGO_NAMES, GroundCargo } from '../../../src/three/scene/GroundCargo'
import { HOOK_LOAD_NAMES, HookLoad } from '../../../src/three/scene/HookLoad'

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

/** Modelo falso do contêiner: 2,4 x 2,9 x 6,01 m (o tamanho do catálogo), base em y = 0. */
function fakeContainer(): Object3D {
  const scene = new Group()
  const geometry = new BoxGeometry(2.4, 2.9, 6.01)
  geometry.translate(0, 1.45, 0)
  scene.add(new Mesh(geometry, new MeshBasicMaterial()))
  return scene
}

const CONTAINER_LOAD = { lengthM: 12.02, widthM: 2.4, heightM: 5.8, cargoType: 'conteiner' }

beforeEach(() => {
  cargoModels.reset(vi.fn(async () => fakeContainer()))
})

describe('carga pendurada com modelo', () => {
  function setup() {
    const hook = new Group()
    const hookLoad = new HookLoad(hook)
    const onReady = vi.fn()
    hookLoad.setOnModelReady(onReady)
    return { hook, hookLoad, onReady }
  }

  it('a caixa fica enquanto o arquivo carrega; depois o modelo toma o lugar, escalado às medidas', async () => {
    const { hook, hookLoad, onReady } = setup()
    hookLoad.setLoad(CONTAINER_LOAD)
    const box = hook.getObjectByName(HOOK_LOAD_NAMES.box)!
    expect(box.visible).toBe(true)
    expect(hook.getObjectByName(HOOK_LOAD_NAMES.model)).toBeUndefined()

    await flush()
    const model = hook.getObjectByName(HOOK_LOAD_NAMES.model)!
    expect(model).toBeDefined()
    expect(onReady).toHaveBeenCalled()
    expect(hookLoad.showsCargoModel).toBe(true)
    // Escala: 12,02 / 6,01 em Z, 2,4 / 2,4 em X e 5,8 / 2,9 em Y (o modelo vai da largura ao comprimento).
    expect(model.scale.toArray()).toEqual([1, 2, 2].map((v) => expect.closeTo(v, 5)))
    // A base do modelo fica na base da caixa: centro da caixa menos meia altura.
    expect(model.position.y).toBeCloseTo(box.position.y - 5.8 / 2)
    expect(box.visible).toBe(false)
    expect(hook.getObjectByName(HOOK_LOAD_NAMES.edges)!.visible).toBe(false)
    // A colisão é pela caixa: o layout da carga continua o das medidas.
    expect(hookLoad.currentLayout?.size).toEqual({ x: 2.4, y: 5.8, z: 12.02 })
  })

  it('destacada por uma colisão, a carga volta a ser a caixa vermelha', async () => {
    const { hook, hookLoad } = setup()
    hookLoad.setLoad(CONTAINER_LOAD)
    await flush()
    hookLoad.setCollisionHighlight(true)
    expect(hook.getObjectByName(HOOK_LOAD_NAMES.model)!.visible).toBe(false)
    expect(hook.getObjectByName(HOOK_LOAD_NAMES.box)!.visible).toBe(true)
    hookLoad.setCollisionHighlight(false)
    expect(hook.getObjectByName(HOOK_LOAD_NAMES.model)!.visible).toBe(true)
    expect(hook.getObjectByName(HOOK_LOAD_NAMES.box)!.visible).toBe(false)
  })

  it('a caixa simples, o tipo desconhecido e o arquivo que falha ficam só com a caixa', async () => {
    const { hook, hookLoad } = setup()
    hookLoad.setLoad({ lengthM: 4, widthM: 2, heightM: 1.5 })
    hookLoad.setLoad({ lengthM: 4, widthM: 2, heightM: 1.5, cargoType: 'caixa' })
    hookLoad.setLoad({ lengthM: 4, widthM: 2, heightM: 1.5, cargoType: 'lixo' })
    await flush()
    expect(hook.getObjectByName(HOOK_LOAD_NAMES.model)).toBeUndefined()

    cargoModels.reset(
      vi.fn(async () => {
        throw new Error('sem rede')
      }),
    )
    hookLoad.setLoad({ lengthM: 4, widthM: 2, heightM: 1.5, cargoType: 'gerador' })
    await flush()
    expect(hook.getObjectByName(HOOK_LOAD_NAMES.model)).toBeUndefined()
    expect(hook.getObjectByName(HOOK_LOAD_NAMES.box)!.visible).toBe(true)
  })

  it('trocar o tipo refaz a carga, e uma resposta atrasada de outro tipo não entra', async () => {
    const { hook, hookLoad } = setup()
    hookLoad.setLoad(CONTAINER_LOAD)
    // Antes de o arquivo chegar, a carga vira caixa simples com as mesmas medidas.
    hookLoad.setLoad({ ...CONTAINER_LOAD, cargoType: 'caixa' })
    await flush()
    expect(hook.getObjectByName(HOOK_LOAD_NAMES.model)).toBeUndefined()
    expect(hook.getObjectByName(HOOK_LOAD_NAMES.box)!.visible).toBe(true)
    // E o tipo é parte do que torna as cargas diferentes: mesmas medidas, outro tipo, refaz.
    hookLoad.setLoad(CONTAINER_LOAD)
    await flush()
    expect(hook.getObjectByName(HOOK_LOAD_NAMES.model)).toBeDefined()
  })

  it('o halo continua envolvendo as medidas da carga', async () => {
    const { hook, hookLoad } = setup()
    hookLoad.setLoad(CONTAINER_LOAD)
    await flush()
    const halo = hook.getObjectByName(HOOK_LOAD_NAMES.halo)!
    expect(halo.scale.z).toBeGreaterThan(12.02 / 2)
    expect(halo.scale.equals(new Vector3(0, 0, 0))).toBe(false)
  })
})

describe('carga no chão com modelo', () => {
  const POSE = { x: 4, z: -6, rotationYDeg: 30 }

  it('mostra a caixa enquanto carrega e o modelo escalado depois, sem refazer a pose', async () => {
    const ground = new GroundCargo()
    const onReady = vi.fn()
    ground.setOnModelReady(onReady)
    ground.show(CONTAINER_LOAD, POSE, 0.5)
    expect(ground.showsModel).toBe(false)
    const group = ground.root.children[0] as Group
    expect((group.children[0] as Mesh).visible).toBe(true)

    await flush()
    const model = ground.root.getObjectByName(GROUND_CARGO_NAMES.model)!
    expect(model).toBeDefined()
    expect(ground.showsModel).toBe(true)
    expect(onReady).toHaveBeenCalled()
    expect(model.scale.toArray()).toEqual([1, 2, 2].map((v) => expect.closeTo(v, 5)))
    const shown = ground.root.children[0] as Group
    // A base do modelo fica na altura dada; o centro do grupo fica meia altura acima dela.
    expect(shown.position.y).toBeCloseTo(0.5 + 5.8 / 2)
    expect(shown.position.x).toBe(4)
    expect(shown.position.z).toBe(-6)
    expect(shown.rotation.y).toBeCloseTo((30 * Math.PI) / 180)
    expect(model.position.y).toBeCloseTo(-5.8 / 2)
    // Sem entrega, só o modelo aparece: caixa e arestas escondidas.
    expect((shown.children[0] as Mesh).visible).toBe(false)
    expect(shown.children[1]!.visible).toBe(false)
  })

  it('na entrega, as arestas verdes voltam por cima do modelo', async () => {
    const ground = new GroundCargo()
    ground.show(CONTAINER_LOAD, POSE, 0, true)
    await flush()
    const shown = ground.root.children[0] as Group
    expect(ground.showsModel).toBe(true)
    expect(shown.children[1]!.visible).toBe(true)
  })

  it('uma carga que mudou antes de o arquivo chegar não leva o modelo antigo', async () => {
    const ground = new GroundCargo()
    ground.show(CONTAINER_LOAD, POSE, 0)
    ground.show({ ...CONTAINER_LOAD, cargoType: undefined }, POSE, 0)
    await flush()
    expect(ground.showsModel).toBe(false)
    expect(ground.root.getObjectByName(GROUND_CARGO_NAMES.model)).toBeUndefined()
  })

  it('a caixa simples não pede modelo nenhum', async () => {
    const loader = vi.fn(async () => fakeContainer())
    cargoModels.reset(loader)
    const ground = new GroundCargo()
    ground.show({ lengthM: 2, widthM: 1, heightM: 1 }, POSE, 0)
    await flush()
    expect(loader).not.toHaveBeenCalled()
    expect(ground.showsModel).toBe(false)
  })
})
