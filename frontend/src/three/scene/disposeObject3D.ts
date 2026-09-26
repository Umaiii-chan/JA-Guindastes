import { type BufferGeometry, Line, type Material, Mesh, type Object3D, Points } from 'three'

/**
 * Libera as geometrias e os materiais de `root` e de todos os descendentes (malhas, linhas — como a
 * grade — e pontos), cada um uma única vez, mesmo quando compartilhado. Texturas não são tratadas:
 * a cena da PoC não usa nenhuma.
 */
export function disposeObject3D(root: Object3D): void {
  const geometries = new Set<BufferGeometry>()
  const materials = new Set<Material>()

  root.traverse((object) => {
    if (!(object instanceof Mesh || object instanceof Line || object instanceof Points)) return
    geometries.add(object.geometry)
    const objectMaterials: Material[] = Array.isArray(object.material)
      ? object.material
      : [object.material]
    for (const material of objectMaterials) materials.add(material)
  })

  for (const geometry of geometries) geometry.dispose()
  for (const material of materials) material.dispose()
}
