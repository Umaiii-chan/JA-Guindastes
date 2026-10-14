import {
  AmbientLight,
  Box3,
  DirectionalLight,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Sphere,
  Vector3,
  WebGLRenderer,
} from 'three'

import type { LibraryObject } from '../../domain/environment/objectLibrary'
import { type ObjectModelCache, objectModels } from './ObjectModels'

// Miniaturas dos objetos da biblioteca (TASK-072; ADR-036), desenhadas uma vez por página com um
// renderer descartável a partir dos próprios GLBs, uma a uma (a paleta mostra cada uma assim que
// pronta). Sem WebGL (testes, navegador sem GPU) não sai nenhuma e a UI usa o ícone da categoria.

const FIELD_OF_VIEW_DEG = 32
const VIEW_DIRECTION = new Vector3(1, 0.75, 1.15).normalize()

const images = new Map<string, string>()
const listeners = new Set<() => void>()
let started = false

/** Miniaturas prontas até agora (data URL PNG por id de objeto). */
export function thumbnailImages(): ReadonlyMap<string, string> {
  return images
}

/** Avisa `listener` a cada miniatura pronta; devolve a função que cancela. */
export function subscribeThumbnails(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * Começa a desenhar as miniaturas (uma vez só por página; chamadas seguintes não fazem nada). Resolve
 * quando acabou, com ou sem sucesso.
 */
export function startThumbnails(
  objects: readonly LibraryObject[],
  sizePx = 112,
  models: ObjectModelCache = objectModels,
): Promise<void> {
  if (started) return Promise.resolve()
  started = true
  return draw(objects, sizePx, models)
}

/** Esquece o que foi desenhado (testes). */
export function resetThumbnails(): void {
  images.clear()
  started = false
}

async function draw(
  objects: readonly LibraryObject[],
  sizePx: number,
  models: ObjectModelCache,
): Promise<void> {
  let renderer: WebGLRenderer | null = null
  try {
    const canvas = document.createElement('canvas')
    renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    })
    renderer.setPixelRatio(1)
    renderer.setSize(sizePx, sizePx, false)
    renderer.outputColorSpace = SRGBColorSpace
    renderer.setClearColor(0x000000, 0)

    const scene = new Scene()
    scene.add(new AmbientLight(0xffffff, 1.6))
    const sun = new DirectionalLight(0xffffff, 2.2)
    sun.position.set(3, 6, 4)
    scene.add(sun)
    const camera = new PerspectiveCamera(FIELD_OF_VIEW_DEG, 1, 0.1, 500)

    for (const object of objects) {
      await models.load(object)
      const copy = models.instance(object.id)
      if (!copy) continue
      scene.add(copy)
      const bounds = new Box3().setFromObject(copy)
      const sphere = bounds.getBoundingSphere(new Sphere())
      const distance = (sphere.radius / Math.sin((FIELD_OF_VIEW_DEG * Math.PI) / 360)) * 1.02
      camera.position.copy(sphere.center).addScaledVector(VIEW_DIRECTION, distance)
      camera.lookAt(sphere.center)
      renderer.render(scene, camera)
      images.set(object.id, canvas.toDataURL('image/png'))
      scene.remove(copy)
      for (const listener of listeners) listener()
    }
  } catch {
    // Sem WebGL: ficam só os ícones.
  } finally {
    renderer?.dispose()
    renderer?.forceContextLoss()
  }
}
