import type { Camera, Vector3 } from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

/** Órbita com o mouse (girar, aproximar, deslocar) em torno de `target`, sem descer abaixo do chão. */
export function createOrbitControls(
  camera: Camera,
  domElement: HTMLElement,
  target: Vector3,
): OrbitControls {
  const controls = new OrbitControls(camera, domElement)
  controls.target.copy(target)
  controls.enableDamping = true
  controls.minDistance = 5
  controls.maxDistance = 150
  controls.maxPolarAngle = Math.PI / 2 - 0.05
  controls.update()
  return controls
}
