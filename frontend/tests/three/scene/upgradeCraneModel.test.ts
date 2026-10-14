/// <reference types="node" />
import { type BufferGeometry, Mesh, type Object3D, Vector3 } from 'three'
import { describe, expect, it, vi } from 'vitest'

import { GltfLoadError } from '../../../src/three/loaders/loadGltf'
import {
  type LoadedTruckCraneModel,
  parseTruckCraneModel,
  TRUCK_CRANE_LUFFING_NODE_NAMES,
  TRUCK_CRANE_NODE_NAMES,
} from '../../../src/three/loaders/loadTruckCraneModel'
import { buildCraneScene } from '../../../src/three/scene/buildCraneScene'
import { disposeObject3D } from '../../../src/three/scene/disposeObject3D'
import { HOOK_LOAD_NAMES } from '../../../src/three/scene/HookLoad'
import {
  type CraneModelLoader,
  upgradeCraneModel,
} from '../../../src/three/scene/upgradeCraneModel'
import { readCraneGlbWithoutTextures } from '../../helpers/craneGlb'
import { expectXyzClose, xyz } from '../../helpers/expectClose'

// Troca do guindaste provisório pelo GLB da TASK-064 (TASK-041). O GLB é lido do disco e entregue
// por um carregador injetado: no Node não há `fetch` para `/models/...`.

const GLB = await readCraneGlbWithoutTextures()

function readGlb(): ArrayBuffer {
  return GLB.slice(0)
}

const fromDisk: CraneModelLoader = () => parseTruckCraneModel(readGlb())

function silentLogger() {
  return { warn: vi.fn() }
}

function worldXyz(object: Object3D): [number, number, number] {
  return object.getWorldPosition(new Vector3()).toArray()
}

function firstGeometry(root: Object3D): BufferGeometry {
  let geometry: BufferGeometry | undefined
  root.traverse((object) => {
    if (!geometry && object instanceof Mesh) geometry = object.geometry
  })
  return geometry!
}

function watchDispose(geometry: BufferGeometry): () => boolean {
  let disposed = false
  geometry.addEventListener('dispose', () => {
    disposed = true
  })
  return () => disposed
}

describe('upgradeCraneModel', () => {
  it('troca o provisório pelo GLB mantendo os comandos, o estado e a ficha', async () => {
    const contents = buildCraneScene()
    const { crane } = contents
    crane.setTurretRotation(40)
    crane.setBoomAngle(50)
    crane.setCableLength(7)
    const before = crane.getState()
    const provisional = contents.rig
    const provisionalDisposed = watchDispose(firstGeometry(provisional.base))
    const logger = silentLogger()

    const result = await upgradeCraneModel(contents, fromDisk, { logger })

    expect(result).toEqual({ status: 'model', warnings: [] })
    // Com a = −1,56 m, a ficha FICTÍCIA do frontend bate com o GLB: nenhum aviso no console.
    expect(logger.warn).not.toHaveBeenCalled()
    expect(contents.usingModel).toBe(true)
    expect(contents.crane).toBe(crane)
    expect(crane.getState()).toEqual(before)
    expect(contents.rig).not.toBe(provisional)
    expect(contents.rig.base.name).toBe(TRUCK_CRANE_NODE_NAMES.base)
    expect(provisional.base.parent).toBeNull()
    expect(provisionalDisposed()).toBe(true)
    expect(contents.scene.getObjectsByProperty('name', TRUCK_CRANE_NODE_NAMES.base)).toHaveLength(1)
  })

  it('o gancho do GLB fica em G calculado com a ficha (a bolinha coincide com o gancho)', async () => {
    const contents = buildCraneScene()
    await upgradeCraneModel(contents, fromDisk, { logger: silentLogger() })
    const { crane } = contents

    for (const [psi, theta, length, cable] of [
      [0, 35, 12, 5],
      [90, 60, 17, 9],
      [-135, 20, 22, 3],
    ]) {
      crane.setTurretRotation(psi)
      crane.setBoomAngle(theta)
      crane.setBoomLength(length)
      crane.setCableLength(cable)
      const geometry = crane.getOperationalGeometry()
      // a do GLB = −1,5591 m, ficha −1,56 m: 0,9 mm de diferença.
      expectXyzClose(worldXyz(contents.rig.hook), xyz(geometry.hook), 2e-3, `G ψ=${psi}`)
    }
  })

  it('reaponta o cilindro de levantamento a cada comando', async () => {
    const contents = buildCraneScene()
    await upgradeCraneModel(contents, fromDisk, { logger: silentLogger() })
    const cylinder = contents.scene.getObjectByName(TRUCK_CRANE_LUFFING_NODE_NAMES.cylinder)!

    contents.crane.setBoomAngle(10)
    const low = cylinder.rotation.x
    contents.crane.setBoomAngle(70)

    expect(cylinder.rotation.x).not.toBeCloseTo(low, 3)
  })

  it('passa a carga e o halo para o gancho do GLB, medindo o gancho novo', async () => {
    const contents = buildCraneScene()
    contents.hookLoad.setLoad({ lengthM: 3, widthM: 2, heightM: 1.5 })
    contents.hookLoad.setStatus('over')
    const provisionalAttach = contents.hookLoad.currentAttachOffsetM

    await upgradeCraneModel(contents, fromDisk, { logger: silentLogger() })

    expect(contents.hookLoad.root.parent).toBe(contents.rig.hook)
    expect(contents.rig.hook.getObjectByName(HOOK_LOAD_NAMES.box)).toBeDefined()
    // O moitão do GLB (GLB da TASK-064) desce ≈ 2 m abaixo de G; o gancho provisório, 1,1 m.
    expect(provisionalAttach).toBeCloseTo(1.1, 2)
    expect(contents.hookLoad.currentAttachOffsetM).toBeGreaterThan(1.5)
    expect(contents.hookLoad.currentLayout!.slingTop.y).toBeCloseTo(
      -contents.hookLoad.currentAttachOffsetM,
    )
    expect(contents.hookLoad.haloIntensity).toBeGreaterThan(0.2)
  })

  it('liga sombras nas malhas do GLB e usa o olho do operador marcado no modelo', async () => {
    const contents = buildCraneScene()
    expect(contents.operatorEye).toBeNull()

    await upgradeCraneModel(contents, fromDisk, { logger: silentLogger() })

    const meshes: Mesh[] = []
    contents.rig.base.traverse((object) => {
      if (object instanceof Mesh && object.parent !== contents.hookLoad.root) meshes.push(object)
    })
    expect(meshes.length).toBeGreaterThan(0)
    expect(meshes.every((mesh) => mesh.castShadow && mesh.receiveShadow)).toBe(true)

    // O GLB marca o olho nos extras da torre: acima da cabine, do lado +X.
    const eye = contents.operatorEye!
    expect(eye.x).toBeGreaterThan(0.4)
    expect(eye.y).toBeGreaterThan(2.5)
    expect(eye.y).toBeLessThan(6)
  })

  it('se o GLB não carregar, fica no provisório com aviso, e os comandos continuam', async () => {
    const contents = buildCraneScene()
    const provisional = contents.rig
    const logger = silentLogger()
    const failing: CraneModelLoader = () =>
      Promise.reject(new GltfLoadError('http-error', 'HTTP 404', { status: 404 }))

    const result = await upgradeCraneModel(contents, failing, { logger })

    expect(result).toMatchObject({ status: 'provisional', reason: 'load-failed' })
    expect(logger.warn).toHaveBeenCalledTimes(1)
    expect(String(logger.warn.mock.calls[0][0])).toContain('guindaste provisório')
    expect(contents.usingModel).toBe(false)
    expect(contents.rig).toBe(provisional)
    expect(provisional.base.parent).toBe(contents.craneAnchor)
    expect(contents.crane.setBoomAngle(45)).toBe(45)
    expect(provisional.boom.rotation.x).toBeCloseTo((-45 * Math.PI) / 180)
  })

  it('se o mapeamento recusar o modelo, fica no provisório e libera o GLB', async () => {
    const contents = buildCraneScene()
    let model: LoadedTruckCraneModel | undefined
    const broken: CraneModelLoader = async () => {
      model = await parseTruckCraneModel(readGlb())
      model.scene.getObjectByName(TRUCK_CRANE_NODE_NAMES.hook)!.removeFromParent()
      return model
    }
    const logger = silentLogger()

    const result = await upgradeCraneModel(contents, broken, { logger })

    expect(result).toMatchObject({ status: 'provisional', reason: 'mapping-rejected' })
    expect(logger.warn).toHaveBeenCalledTimes(1)
    expect(contents.usingModel).toBe(false)
    expect(model!.scene.parent).toBeNull()
  })

  it('cancelado (cena desmontada), não põe o GLB na cena e o libera, sem aviso', async () => {
    const contents = buildCraneScene()
    const abort = new AbortController()
    let modelDisposed: (() => boolean) | undefined
    const slow: CraneModelLoader = async () => {
      const model = await parseTruckCraneModel(readGlb())
      modelDisposed = watchDispose(firstGeometry(model.scene))
      abort.abort()
      return model
    }
    const logger = silentLogger()

    const result = await upgradeCraneModel(contents, slow, { signal: abort.signal, logger })

    expect(result).toMatchObject({ status: 'provisional', reason: 'cancelled' })
    expect(modelDisposed!()).toBe(true)
    expect(contents.usingModel).toBe(false)
    expect(logger.warn).not.toHaveBeenCalled()
  })

  it('dispose da cena libera as geometrias do GLB', async () => {
    const contents = buildCraneScene()
    await upgradeCraneModel(contents, fromDisk, { logger: silentLogger() })
    const modelDisposed = watchDispose(firstGeometry(contents.rig.base))

    disposeObject3D(contents.scene)

    expect(modelDisposed()).toBe(true)
  })

  it('só troca uma vez', async () => {
    const contents = buildCraneScene()
    await upgradeCraneModel(contents, fromDisk, { logger: silentLogger() })
    const logger = silentLogger()

    const again = await upgradeCraneModel(contents, fromDisk, { logger })

    expect(again).toMatchObject({ status: 'provisional', reason: 'mapping-rejected' })
    expect(contents.scene.getObjectsByProperty('name', TRUCK_CRANE_NODE_NAMES.base)).toHaveLength(1)
  })
})

describe('loadDefaultCraneModel', () => {
  it('baixa o GLB uma vez por página e não guarda respostas de erro', async () => {
    // Módulo novo: o cache dos bytes é do módulo.
    vi.resetModules()
    const { loadDefaultCraneModel } = await import('../../../src/three/scene/upgradeCraneModel')
    const responses = [new Response('não achei', { status: 404 })]
    const requested: string[] = []
    const fakeFetch = vi.fn(async (url: RequestInfo | URL) => {
      requested.push(String(url))
      return responses.shift() ?? new Response(readGlb(), { status: 200 })
    })
    vi.stubGlobal('fetch', fakeFetch)
    try {
      const signal = new AbortController().signal

      await expect(loadDefaultCraneModel(signal)).rejects.toMatchObject({ code: 'http-error' })
      const first = await loadDefaultCraneModel(signal)
      const second = await loadDefaultCraneModel(signal)

      expect(fakeFetch).toHaveBeenCalledTimes(2)
      expect(requested[0]).toMatch(/models\/guindaste-80t\.glb$/)
      // Cada montagem recebe uma cena própria (a anterior é liberada no dispose).
      expect(second.scene).not.toBe(first.scene)
      expect(second.scene.getObjectByName(TRUCK_CRANE_NODE_NAMES.hook)).toBeDefined()
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
