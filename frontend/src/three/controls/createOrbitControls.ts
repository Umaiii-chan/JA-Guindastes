import type { Camera, Vector3 } from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

import { CAMERA_LIMITS, maxPolarAngleAboveGround } from '../camera/cameraPresets'

/**
 * Órbita com o mouse (girar, aproximar, deslocar) em torno de `target`, com limites de zoom e de
 * ângulo para a câmera não atravessar o chão (TASK-041, CA-5).
 */
export function createOrbitControls(
  camera: Camera,
  domElement: HTMLElement,
  target: Vector3,
): OrbitControls {
  const controls = new OrbitControls(camera, domElement)
  controls.target.copy(target)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.minDistance = CAMERA_LIMITS.minDistanceM
  controls.maxDistance = CAMERA_LIMITS.maxDistanceM
  applyCameraLimits(controls)
  controls.update()
  return controls
}

/**
 * Mantém o alvo no chão ou acima dele (o deslocamento com o botão direito pode levá-lo para baixo) e
 * limita o ângulo polar para a câmera ficar acima do chão com o alvo e a distância atuais. Chamar
 * antes de cada `controls.update()`.
 */
export function applyCameraLimits(controls: OrbitControls): void {
  if (controls.target.y < 0) controls.target.y = 0
  const distance = controls.object.position.distanceTo(controls.target)
  controls.maxPolarAngle = maxPolarAngleAboveGround(controls.target.y, distance)
}

/**
 * Rede de segurança depois de `controls.update()`: o limite polar usa a distância do quadro anterior,
 * então um zoom para fora com a câmera baixa pode deixá-la abaixo da altura mínima por um quadro.
 * Devolve `true` se precisou subir a câmera.
 */
export function keepCameraAboveGround(controls: OrbitControls): boolean {
  const position = controls.object.position
  if (position.y >= CAMERA_LIMITS.minHeightM) return false
  position.y = CAMERA_LIMITS.minHeightM
  return true
}
