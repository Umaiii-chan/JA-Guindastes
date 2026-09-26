/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import type { Object3D } from 'three'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'

/** GLB de exemplo FICTÍCIO versionado na raiz do repositório (TASK-026). */
export const EXAMPLE_GLB_PATH = fileURLToPath(
  new URL('../../../assets/example-models/guindaste-provisorio.ficticio.glb', import.meta.url),
)

/** Lê o GLB de exemplo como ArrayBuffer (cópia própria, fora do pool de `Buffer` do Node). */
export function readExampleGlb(): ArrayBuffer {
  const bytes = readFileSync(EXAMPLE_GLB_PATH)
  const copy = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(copy).set(bytes)
  return copy
}

/**
 * Exporta um objeto para GLB com o GLTFExporter. O exportador usa `FileReader`, que o Node não tem;
 * aqui entra um substituto mínimo, só com o que o exportador chama.
 */
export async function exportGlb(root: Object3D): Promise<ArrayBuffer> {
  installFileReaderShim()
  const result = await new GLTFExporter().parseAsync(root, { binary: true })
  if (!(result instanceof ArrayBuffer)) {
    throw new Error('GLTFExporter não devolveu um GLB (ArrayBuffer).')
  }
  return result
}

function installFileReaderShim(): void {
  if (typeof globalThis.FileReader !== 'undefined') return

  class FileReaderShim {
    result: ArrayBuffer | string | null = null
    onloadend: (() => void) | null = null

    readAsArrayBuffer(blob: Blob): void {
      void blob.arrayBuffer().then((buffer) => {
        this.result = buffer
        this.onloadend?.()
      })
    }

    readAsDataURL(blob: Blob): void {
      void blob.arrayBuffer().then((buffer) => {
        this.result = `data:${blob.type};base64,${Buffer.from(buffer).toString('base64')}`
        this.onloadend?.()
      })
    }
  }

  ;(globalThis as { FileReader?: unknown }).FileReader = FileReaderShim
}
