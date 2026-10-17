// Acessórios de terceiros chegam deitados (o gancho e a manilha no plano XZ): sem a pose registrada,
// a cadeia os desenhava de lado e com 1/10 da altura, fora do cabo (relato de 2026-10-17). As medidas
// abaixo são as dos GLBs de `frontend/public/models/acessorios` (CREDITS.md).

import { Box3, BoxGeometry, Mesh, type Object3D, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import { AccessoryChain } from '../../../src/three/accessories/AccessoryChain'

const URL_BASE = '/models/acessorios/'

async function sizeOfLoaded(
  file: string,
  boxSize: [number, number, number],
  heightM: number,
): Promise<{ size: Vector3; max: Vector3; center: Vector3 }> {
  const chain = new AccessoryChain({
    loader: async () => new Mesh(new BoxGeometry(...boxSize)),
  })
  const loaded = new Promise<void>((resolve) => {
    // `onModelResult` só vem nas opções; a espera abaixo cobre o carregamento assíncrono.
    queueMicrotask(resolve)
  })
  chain.setAccessories([{ id: 'a', riggingHeightM: heightM, modelUrl: `${URL_BASE}${file}` }])
  await loaded
  await new Promise((resolve) => setTimeout(resolve, 0))
  chain.root.updateMatrixWorld(true)
  const box = new Box3().setFromObject(chain.root as Object3D)
  return { size: box.getSize(new Vector3()), max: box.max, center: box.getCenter(new Vector3()) }
}

describe('pose dos modelos de acessório na cadeia', () => {
  it('gancho: a maior medida fica na vertical e mede a altura da cadeia (0,6 m)', async () => {
    const { size, max, center } = await sizeOfLoaded(
      'gancho-polydavid.glb',
      [5.575, 0.388, 3.552],
      0.6,
    )
    expect(size.y).toBeCloseTo(0.6, 3)
    expect(size.x).toBeCloseTo((0.388 / 5.575) * 0.6, 3)
    expect(size.z).toBeCloseTo((3.552 / 5.575) * 0.6, 3)
    expect(max.y).toBeCloseTo(0, 3) // o topo (olhal) na origem, no cabo
    expect(center.x).toBeCloseTo(0, 3)
    expect(center.z).toBeCloseTo(0, 3)
  })

  it('manilha: o comprimento do laço ao pino fica na vertical (0,15 m)', async () => {
    const { size, max } = await sizeOfLoaded('manilha-3ddomino.glb', [3.622, 1.575, 4.272], 0.15)
    expect(size.y).toBeCloseTo(0.15, 3)
    expect(size.x).toBeCloseTo((3.622 / 4.272) * 0.15, 3)
    expect(max.y).toBeCloseTo(0, 3)
  })

  it('modelo sem pose registrada segue a regra antiga: o maior lado cabe na altura', async () => {
    const { size } = await sizeOfLoaded('outro.glb', [4, 1, 2], 1)
    expect(size.x).toBeCloseTo(1, 3)
    expect(size.y).toBeCloseTo(0.25, 3)
  })
})
