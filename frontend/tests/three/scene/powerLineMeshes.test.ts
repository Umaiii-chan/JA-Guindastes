// Redes elétricas na cena (TASK-107; ADR-051): o cabo liga os dois pontos, os postes descem ao
// terreno e a zona de distância mínima tem a medida da tabela. Sem WebGL.

import { Box3, type Mesh, type Object3D, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import { type PowerLine, requiredClearanceM } from '../../../src/domain/environment/powerLine'
import { EMPTY_SCENARIO } from '../../../src/domain/environment/environment'
import { buildCraneScene } from '../../../src/three/scene/buildCraneScene'
import { PowerLineMeshes } from '../../../src/three/scene/PowerLineMeshes'

const LINE: PowerLine = {
  id: 'rede-1',
  label: 'Rede FICTÍCIA',
  x1M: -8,
  z1M: 4,
  x2M: 4,
  z2M: -5, // trecho inclinado: 15 m de comprimento (9 × 12)
  heightM: 11,
  voltageKv: 138,
}
const flat = () => 0

function named(root: Object3D, name: string): Object3D[] {
  const found: Object3D[] = []
  root.traverse((object) => {
    if (object.name === name) found.push(object)
  })
  return found
}

function worldEnds(cable: Mesh, lengthM: number): [Vector3, Vector3] {
  cable.updateMatrixWorld(true)
  return [
    new Vector3(0, lengthM / 2, 0).applyMatrix4(cable.matrixWorld),
    new Vector3(0, -lengthM / 2, 0).applyMatrix4(cable.matrixWorld),
  ]
}

describe('PowerLineMeshes', () => {
  it('desenha o cabo entre os dois pontos, à altura da rede', () => {
    const meshes = new PowerLineMeshes()
    meshes.setLines([LINE], flat)

    const [cable] = named(meshes.root, 'power-line-cable') as Mesh[]
    const [a, b] = worldEnds(cable!, Math.hypot(12, 9))
    const ends = [a, b].sort((p, q) => p.x - q.x)
    expect(ends[0]!.x).toBeCloseTo(-8, 6)
    expect(ends[0]!.z).toBeCloseTo(4, 6)
    expect(ends[1]!.x).toBeCloseTo(4, 6)
    expect(ends[1]!.z).toBeCloseTo(-5, 6)
    expect(a.y).toBeCloseTo(11, 6)
    expect(b.y).toBeCloseTo(11, 6)
  })

  it('um poste em cada ponta, do terreno até a rede', () => {
    const meshes = new PowerLineMeshes()
    meshes.setLines([LINE], (x) => (x < 0 ? 1 : 0))

    const poles = named(meshes.root, 'power-line-pole') as Mesh[]
    expect(poles).toHaveLength(2)
    const heights = poles.map((pole) => new Box3().setFromObject(pole).getSize(new Vector3()).y)
    expect(heights.sort()).toEqual([10, 11])
  })

  it('a zona tem a medida da tabela da tensão: comprimento + 2d, 2d de largura e de altura', () => {
    const meshes = new PowerLineMeshes()
    meshes.setLines([LINE], flat)

    const [zone] = named(meshes.root, 'power-line-zone')
    const d = requiredClearanceM(138)!
    // Desfaz o giro para medir ao longo do trecho.
    zone!.rotation.y = 0
    zone!.updateMatrixWorld(true)
    const size = new Box3().setFromObject(zone!).getSize(new Vector3())
    expect(size.x).toBeCloseTo(15 + 2 * d, 4) // vértices em float32
    expect(size.y).toBeCloseTo(2 * d, 4)
    expect(size.z).toBeCloseTo(2 * d, 4)
  })

  it('refazer a lista troca os desenhos e esvaziá-la os remove', () => {
    const meshes = new PowerLineMeshes()
    meshes.setLines([LINE, { ...LINE, id: 'rede-2' }], flat)
    expect(meshes.root.children).toHaveLength(2)
    meshes.setLines([LINE], flat)
    expect(meshes.root.children).toHaveLength(1)
    meshes.setLines([], flat)
    expect(meshes.root.children).toHaveLength(0)
  })

  it('o cenário da cena aplica as redes e volta a limpar ao trocar de cenário', () => {
    const contents = buildCraneScene()
    contents.setScenario({ ...EMPTY_SCENARIO, powerLines: [LINE] })
    expect(contents.powerLines.root.children).toHaveLength(1)
    contents.setScenario(EMPTY_SCENARIO)
    expect(contents.powerLines.root.children).toHaveLength(0)
  })
})
