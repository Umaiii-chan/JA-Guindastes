import { PerspectiveCamera } from 'three'
import { describe, expect, it } from 'vitest'

import { createCamera, resizeCamera } from '../../../src/three/camera/createCamera'

describe('createCamera', () => {
  it('cria uma câmera perspectiva com a proporção pedida', () => {
    const camera = createCamera(2)

    expect(camera).toBeInstanceOf(PerspectiveCamera)
    expect(camera.aspect).toBe(2)
  })

  it('resizeCamera atualiza a proporção e a matriz de projeção', () => {
    const camera = createCamera(1)
    const before = camera.projectionMatrix.clone()

    resizeCamera(camera, 800, 400)

    expect(camera.aspect).toBe(2)
    expect(camera.projectionMatrix.equals(before)).toBe(false)
  })

  it.each([
    [0, 400],
    [800, 0],
  ])('resizeCamera ignora tamanho sem área (%s × %s)', (width, height) => {
    const camera = createCamera(1.5)

    resizeCamera(camera, width, height)

    expect(camera.aspect).toBe(1.5)
  })
})
