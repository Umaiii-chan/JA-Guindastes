import { PerspectiveCamera } from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { describe, expect, it } from 'vitest'

import { CAMERA_LIMITS } from '../../../src/three/camera/cameraPresets'
import {
  applyCameraLimits,
  keepCameraAboveGround,
} from '../../../src/three/controls/createOrbitControls'

// Sem `domElement`: o OrbitControls não liga eventos, e dá para testar só os limites em Node.
function controlsAt(position: [number, number, number], target: [number, number, number]) {
  const camera = new PerspectiveCamera()
  camera.position.set(...position)
  const controls = new OrbitControls(camera)
  controls.target.set(...target)
  return controls
}

describe('limites da câmera', () => {
  it('traz o alvo de volta ao chão quando o deslocamento o leva para baixo', () => {
    const controls = controlsAt([10, 10, 10], [0, -3, 0])

    applyCameraLimits(controls)

    expect(controls.target.y).toBe(0)
  })

  it('limita o ângulo polar pela altura do alvo e pela distância', () => {
    // Câmera levada bem para baixo do alvo: o limite a segura acima do chão.
    const controls = controlsAt([0, -30, 1], [0, 7, 0])

    applyCameraLimits(controls)
    controls.update()

    expect(controls.object.position.y).toBeGreaterThanOrEqual(CAMERA_LIMITS.minHeightM - 1e-6)
  })

  it('keepCameraAboveGround sobe a câmera até a altura mínima', () => {
    const controls = controlsAt([5, -2, 5], [0, 0, 0])

    keepCameraAboveGround(controls)

    expect(controls.object.position.y).toBe(CAMERA_LIMITS.minHeightM)
  })
})
