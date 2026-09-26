import { Box3, Matrix4, Mesh, type Object3D } from 'three'

import type { Vec3 } from '../camera/cameraPresets'
import type { CraneRig } from './CraneController'

// Pontos de referência visuais tirados das malhas do rig (TASK-041): onde o gancho termina (para
// pendurar a carga e ajustar o halo) e onde fica o olho do operador. Só desenho e câmera: nada disso
// entra no cálculo (RN-003; ADR-013 C-7).

/** Materiais ou malhas de vidro da cabine, pelo nome (convenção do GLB da TASK-043: `torre-vidro`). */
const CAB_GLASS_PATTERN = /vidro|glass/i

/** Caixa das malhas sob `root` no referencial de `frame`, sem os ramos em `exclude`. */
export function boxInFrameOf(
  frame: Object3D,
  root: Object3D,
  exclude: readonly Object3D[] = [],
): Box3 | null {
  frame.updateWorldMatrix(true, true)
  root.updateWorldMatrix(true, true)
  const toFrame = new Matrix4().copy(frame.matrixWorld).invert()
  const box = new Box3()
  const stack: Object3D[] = [root]
  while (stack.length > 0) {
    const object = stack.pop()!
    if (exclude.includes(object)) continue
    if (object instanceof Mesh) {
      const geometry = object.geometry
      if (!geometry.boundingBox) geometry.computeBoundingBox()
      const meshBox = geometry.boundingBox!.clone()
      meshBox.applyMatrix4(new Matrix4().multiplyMatrices(toFrame, object.matrixWorld))
      box.union(meshBox)
    }
    stack.push(...object.children)
  }
  return box.isEmpty() ? null : box
}

/** Caixa das malhas do gancho no referencial do nó do gancho (origem em G), sem os ramos em `exclude`. */
export function measureHookExtent(hook: Object3D, exclude: readonly Object3D[] = []): Box3 | null {
  return boxInFrameOf(hook, hook, exclude)
}

/**
 * Olho do operador no referencial da base com ψ = 0, a partir do vidro da cabine na torre (malhas
 * da torre, fora da lança, com "vidro"/"glass" no nome da malha ou do material): no meio do vidro, a
 * 60 % da altura. `null` se o rig não tiver vidro na torre (o guindaste provisório não tem).
 */
export function findOperatorEye(rig: CraneRig): Vec3 | null {
  const glass: Object3D[] = []
  const stack: Object3D[] = [...rig.turret.children]
  while (stack.length > 0) {
    const object = stack.pop()!
    if (object === rig.boom) continue
    if (object instanceof Mesh && isGlass(object)) glass.push(object)
    stack.push(...object.children)
  }
  if (glass.length === 0) return null

  const box = new Box3()
  for (const mesh of glass) {
    const meshBox = boxInFrameOf(rig.turret, mesh)
    if (meshBox) box.union(meshBox)
  }
  if (box.isEmpty()) return null
  // Referencial da torre → base com ψ = 0: só a translação da torre (ela não tem outra rotação).
  const turret = rig.turret.position
  return {
    x: turret.x + (box.min.x + box.max.x) / 2,
    y: turret.y + box.min.y + (box.max.y - box.min.y) * 0.6,
    z: turret.z + (box.min.z + box.max.z) / 2,
  }
}

function isGlass(mesh: Mesh): boolean {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
  return (
    CAB_GLASS_PATTERN.test(mesh.name) ||
    materials.some((material) => CAB_GLASS_PATTERN.test(material.name))
  )
}
