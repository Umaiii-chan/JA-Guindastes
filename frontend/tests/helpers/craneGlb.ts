/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'

// O GLB do guindaste (TASK-064) tem texturas, e o GLTFLoader não decodifica imagens no Node (não há
// `Image` nem `createImageBitmap`). Os testes de nós e de cinemática leem o arquivo versionado sem as
// texturas: a geometria e a hierarquia são as mesmas.

// Sem o `URL` global: no ambiente jsdom ele é o do jsdom, que o `fileURLToPath` do Node recusa.
export const CRANE_GLB_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../public/models/guindaste-80t.glb',
)

/** Bytes do GLB versionado, tal como estão no disco. */
export function readCraneGlbBytes(): Buffer {
  return readFileSync(CRANE_GLB_PATH)
}

/** O mesmo GLB, sem as texturas. */
export async function readCraneGlbWithoutTextures(): Promise<ArrayBuffer> {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  const document = await io.readBinary(new Uint8Array(readCraneGlbBytes()))
  for (const texture of document.getRoot().listTextures()) texture.dispose()
  const bytes = await io.writeBinary(document)
  const copy = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(copy).set(bytes)
  return copy
}
