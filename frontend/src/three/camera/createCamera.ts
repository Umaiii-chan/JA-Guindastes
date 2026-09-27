import { PerspectiveCamera, Vector3 } from 'three'

/** Ponto para onde a câmera olha no início e em torno do qual a órbita gira. */
export const INITIAL_CAMERA_TARGET = new Vector3(0, 7, 3)

/** Câmera perspectiva enquadrando o guindaste provisório. */
export function createCamera(aspect: number): PerspectiveCamera {
  // `far` cobre o domo do céu (que acompanha a câmera) com folga.
  const camera = new PerspectiveCamera(50, aspect, 0.1, 2000)
  camera.position.set(22, 13, 28)
  camera.lookAt(INITIAL_CAMERA_TARGET)
  return camera
}

/** Atualiza a proporção da câmera; ignora tamanhos sem área (elemento oculto ou ainda sem layout). */
export function resizeCamera(camera: PerspectiveCamera, width: number, height: number): void {
  if (width <= 0 || height <= 0) return
  camera.aspect = width / height
  camera.updateProjectionMatrix()
}
