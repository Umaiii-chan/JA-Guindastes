import { Mesh, type Object3D } from 'three'

/** Sombras suaves no chão (CA-1): malhas opacas projetam e recebem; vidro só recebe. */
export function enableShadows(root: Object3D): void {
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    object.castShadow = !materials.some((material) => material.transparent)
    object.receiveShadow = true
  })
}
