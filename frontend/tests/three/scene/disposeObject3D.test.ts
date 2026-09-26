import {
  BoxGeometry,
  type BufferGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  type Material,
  Mesh,
  MeshBasicMaterial,
} from 'three'
import { describe, expect, it } from 'vitest'

import { buildCraneScene } from '../../../src/three/scene/buildCraneScene'
import { disposeObject3D } from '../../../src/three/scene/disposeObject3D'

/** Conta quantas vezes cada recurso disparou o evento `dispose`. */
function trackDisposals(resources: (BufferGeometry | Material)[]): Map<object, number> {
  const counts = new Map<object, number>()
  for (const resource of resources) {
    counts.set(resource, 0)
    resource.addEventListener('dispose', () =>
      counts.set(resource, (counts.get(resource) ?? 0) + 1),
    )
  }
  return counts
}

describe('disposeObject3D', () => {
  it('libera geometrias e materiais de malhas e linhas em qualquer nível', () => {
    const meshGeometry = new BoxGeometry()
    const meshMaterial = new MeshBasicMaterial()
    const lineGeometry = new BoxGeometry()
    const lineMaterial = new LineBasicMaterial()
    const root = new Group()
    const nested = new Group()
    nested.add(new Mesh(meshGeometry, meshMaterial))
    root.add(nested)
    root.add(new LineSegments(lineGeometry, lineMaterial))
    const counts = trackDisposals([meshGeometry, meshMaterial, lineGeometry, lineMaterial])

    disposeObject3D(root)

    expect([...counts.values()]).toEqual([1, 1, 1, 1])
  })

  it('libera uma única vez o que é compartilhado entre malhas', () => {
    const geometry = new BoxGeometry()
    const material = new MeshBasicMaterial()
    const root = new Group()
    root.add(new Mesh(geometry, material), new Mesh(geometry, material))
    const counts = trackDisposals([geometry, material])

    disposeObject3D(root)

    expect(counts.get(geometry)).toBe(1)
    expect(counts.get(material)).toBe(1)
  })

  it('libera todos os materiais de uma malha com vários materiais', () => {
    const materials = [new MeshBasicMaterial(), new MeshBasicMaterial()]
    const root = new Mesh(new BoxGeometry(), materials)
    const counts = trackDisposals(materials)

    disposeObject3D(root)

    expect([...counts.values()]).toEqual([1, 1])
  })

  it('libera todos os recursos da cena da PoC', () => {
    const { scene } = buildCraneScene()
    const resources: (BufferGeometry | Material)[] = []
    scene.traverse((object) => {
      if (object instanceof Mesh || object instanceof LineSegments) {
        resources.push(object.geometry, ...[object.material].flat())
      }
    })
    const counts = trackDisposals([...new Set(resources)])

    disposeObject3D(scene)

    expect(counts.size).toBeGreaterThan(0)
    expect([...counts.values()].every((count) => count === 1)).toBe(true)
  })
})
