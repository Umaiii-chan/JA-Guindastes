/// <reference types="node" />
import { existsSync, writeFileSync } from 'node:fs'

import type { Object3D } from 'three'
import { describe, expect, it } from 'vitest'

import {
  CRANE_NODE_NAMES,
  createProvisionalCrane,
} from '../../../src/three/crane/createProvisionalCrane'
import { parseGltf } from '../../../src/three/loaders/loadGltf'
import { EXAMPLE_GLB_PATH, exportGlb, readExampleGlb } from '../../helpers/exampleModel'

// Gerador e conferência do modelo de EXEMPLO FICTÍCIO em assets/example-models/ (TASK-026). Ele é o
// guindaste provisório da PoC (createProvisionalCrane, medidas FICTÍCIAS, ADR-012) exportado em GLB,
// na pose de repouso do ADR-013 C-4, regra 4. Não descreve nenhum guindaste real (L-002).
//
// Para regenerar o arquivo (depois de mudar o guindaste provisório), em frontend/:
//   bash:        UPDATE_EXAMPLE_GLB=1 npx vitest run tests/three/loaders/exampleModel.test.ts
//   PowerShell:  $env:UPDATE_EXAMPLE_GLB='1'; npx vitest run tests/three/loaders/exampleModel.test.ts

const FICTITIOUS_LABEL = {
  ficticio: true,
  aviso:
    'MODELO FICTÍCIO: guindaste provisório da PoC (TASK-013/016), não representa nenhum guindaste real. Gerado pela TASK-026.',
}

function buildExampleCrane(): Object3D {
  const rig = createProvisionalCrane()
  rig.base.userData = { ...FICTITIOUS_LABEL }
  return rig.base
}

interface NodeSummary {
  readonly name: string
  readonly position: readonly number[]
  readonly children: readonly NodeSummary[]
}

const MAPPED_NAMES: ReadonlySet<string> = new Set(Object.values(CRANE_NODE_NAMES))

/** Hierarquia dos nós do mapeamento, com a posição local de cada um (os demais são ignorados). */
function namedHierarchy(object: Object3D): NodeSummary[] {
  return object.children.flatMap((child) =>
    MAPPED_NAMES.has(child.name)
      ? [
          {
            name: child.name,
            position: child.position.toArray().map((value) => Number(value.toFixed(9))),
            children: namedHierarchy(child),
          },
        ]
      : namedHierarchy(child),
  )
}

describe('modelo de exemplo FICTÍCIO (assets/example-models)', () => {
  it.runIf(process.env.UPDATE_EXAMPLE_GLB === '1')('regenera o GLB de exemplo', async () => {
    writeFileSync(EXAMPLE_GLB_PATH, new Uint8Array(await exportGlb(buildExampleCrane())))
  })

  it('existe e é um GLB (cabeçalho "glTF", versão 2)', () => {
    expect(existsSync(EXAMPLE_GLB_PATH)).toBe(true)
    const header = new DataView(readExampleGlb(), 0, 12)

    expect(header.getUint32(0, true)).toBe(0x46546c67) // "glTF"
    expect(header.getUint32(4, true)).toBe(2)
  })

  it('tem os nós do mapeamento do guindaste provisório, cada um uma vez', async () => {
    const loaded = await parseGltf(readExampleGlb())

    for (const name of Object.values(CRANE_NODE_NAMES)) {
      expect(loaded.sourceNodeNames.filter((nodeName) => nodeName === name)).toHaveLength(1)
    }
  })

  it('está rotulado FICTÍCIO no próprio arquivo (extras do nó base)', async () => {
    const loaded = await parseGltf(readExampleGlb())

    expect(loaded.scene.getObjectByName(CRANE_NODE_NAMES.base)?.userData).toMatchObject(
      FICTITIOUS_LABEL,
    )
  })

  it('está em dia com o guindaste provisório (mesma hierarquia e posições dos nós do mapeamento)', async () => {
    const loaded = await parseGltf(readExampleGlb())
    const expectedRoot = buildExampleCrane()
    const loadedBase = loaded.scene.getObjectByName(CRANE_NODE_NAMES.base)!

    expect(loadedBase.parent).toBe(loaded.scene)
    expect(namedHierarchy(loaded.scene)).toEqual(
      namedHierarchy({ children: [expectedRoot] } as Object3D),
    )
  })
})
