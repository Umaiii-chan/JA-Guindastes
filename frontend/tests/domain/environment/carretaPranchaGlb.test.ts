// O GLB da carreta prancha (TASK-108) é desenhado por código (`scripts/build-carreta-prancha.mjs`): confere
// que toda face aponta para fora, ou o modelo apareceria "do avesso" na cena (faces de trás são descartadas).

import { resolve } from 'node:path'

import { NodeIO } from '@gltf-transform/core'
import { describe, expect, it } from 'vitest'

describe('carreta-prancha.glb', () => {
  it('toda face tem o enrolamento coerente com a normal gravada (aponta para fora)', async () => {
    const doc = await new NodeIO().read(
      resolve(__dirname, '../../../public/models/objetos/carreta-prancha.glb'),
    )
    let triangles = 0
    for (const primitive of doc.getRoot().listMeshes()[0]!.listPrimitives()) {
      const position = primitive.getAttribute('POSITION')!.getArray() as Float32Array
      const normal = primitive.getAttribute('NORMAL')!.getArray() as Float32Array
      const index = primitive.getIndices()!.getArray() as Uint16Array
      for (let i = 0; i < index.length; i += 3) {
        const [a, b, c] = [index[i]!, index[i + 1]!, index[i + 2]!]
        const p = (k: number) => [position[3 * k]!, position[3 * k + 1]!, position[3 * k + 2]!]
        const [pa, pb, pc] = [p(a), p(b), p(c)] as [number[], number[], number[]]
        const u = [pb[0]! - pa[0]!, pb[1]! - pa[1]!, pb[2]! - pa[2]!]
        const v = [pc[0]! - pa[0]!, pc[1]! - pa[1]!, pc[2]! - pa[2]!]
        const face = [
          u[1]! * v[2]! - u[2]! * v[1]!,
          u[2]! * v[0]! - u[0]! * v[2]!,
          u[0]! * v[1]! - u[1]! * v[0]!,
        ]
        const dot =
          face[0]! * normal[3 * a]! + face[1]! * normal[3 * a + 1]! + face[2]! * normal[3 * a + 2]!
        expect(dot, `triângulo ${triangles}`).toBeGreaterThan(0)
        triangles += 1
      }
    }
    expect(triangles).toBeGreaterThan(100)
  })
})
