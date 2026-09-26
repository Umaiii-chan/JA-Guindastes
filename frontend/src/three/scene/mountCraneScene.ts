import { WebGLRenderer } from 'three'

import { createCamera, INITIAL_CAMERA_TARGET, resizeCamera } from '../camera/createCamera'
import { createOrbitControls } from '../controls/createOrbitControls'
import type { CraneCommands } from '../crane/types'
import { buildCraneScene } from './buildCraneScene'
import { disposeObject3D } from './disposeObject3D'

/** O que a UI recebe da cena montada: só os comandos do guindaste e a limpeza, sem objetos Three.js. */
export interface CraneSceneHandle {
  readonly crane: CraneCommands
  /** Para o laço de renderização e libera renderer, controles, geometrias e materiais. Idempotente. */
  dispose(): void
}

/**
 * Cria o renderer WebGL dentro de `container` (que deve ter tamanho definido pelo layout) e começa a
 * desenhar a cena do guindaste provisório. Lança erro se o navegador não oferecer WebGL.
 */
export function mountCraneScene(container: HTMLElement): CraneSceneHandle {
  const { scene, crane } = buildCraneScene()

  const renderer = new WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.domElement.style.display = 'block'
  renderer.domElement.style.width = '100%'
  renderer.domElement.style.height = '100%'
  container.appendChild(renderer.domElement)

  const camera = createCamera(1)
  const controls = createOrbitControls(camera, renderer.domElement, INITIAL_CAMERA_TARGET)

  const resize = (): void => {
    const width = container.clientWidth
    const height = container.clientHeight
    if (width <= 0 || height <= 0) return
    // `false`: o CSS acima já estica o canvas; aqui só muda a resolução do desenho.
    renderer.setSize(width, height, false)
    resizeCamera(camera, width, height)
  }
  resize()
  const resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(container)

  renderer.setAnimationLoop(() => {
    controls.update()
    renderer.render(scene, camera)
  })

  let disposed = false
  return {
    crane,
    dispose() {
      if (disposed) return
      disposed = true
      renderer.setAnimationLoop(null)
      resizeObserver.disconnect()
      controls.dispose()
      disposeObject3D(scene)
      renderer.dispose()
      // Libera o contexto WebGL já, sem esperar o coletor de lixo: o navegador limita quantos
      // contextos podem existir (o StrictMode do React monta e desmonta a cena duas vezes em dev).
      renderer.forceContextLoss()
      renderer.domElement.remove()
    },
  }
}
