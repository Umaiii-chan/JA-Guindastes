import { Box3, Matrix4, Mesh, type Object3D } from 'three'

import type { Vec3 } from '../camera/cameraPresets'
import type { CraneRig } from './CraneController'

// Pontos de referência visuais tirados das malhas do rig (TASK-041): onde o gancho termina (para
// pendurar a carga e ajustar o halo) e onde fica o olho do operador. Só desenho e câmera: nada disso
// entra no cálculo (RN-003; ADR-013 C-7).

/** Materiais ou malhas de vidro da cabine, pelo nome (convenção do GLB da TASK-043: `torre-vidro`). */
const CAB_GLASS_PATTERN = /vidro|glass/i
/** Chave dos `extras` da torre que marca o olho do operador, [x, y, z] (opcional; TASK-064). */
export const OPERATOR_EYE_EXTRA = 'olhoDoOperador'
/** Altura do olho do operador acima do topo do vidro da cabine (m). */
export const OPERATOR_EYE_ABOVE_GLASS_M = 0.5

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
 * da torre, fora da lança, com "vidro"/"glass" no nome da malha ou do material): na vertical do meio
 * do vidro, `OPERATOR_EYE_ABOVE_GLASS_M` acima do topo dele. Por dentro da cabine, o painel e as
 * colunas tapavam a vista (conferido nas capturas), então o olho fica logo acima do teto, como no
 * guindaste provisório. `null` se o rig não tiver vidro na torre (o provisório não tem).
 */
export function findOperatorEye(rig: CraneRig): Vec3 | null {
  // Modelo com o ponto marcado nos `extras` da torre (GLB da TASK-064), no referencial da torre.
  const marked: unknown = rig.turret.userData[OPERATOR_EYE_EXTRA]
  if (isVec3Array(marked)) {
    const turret = rig.turret.position
    return { x: turret.x + marked[0], y: turret.y + marked[1], z: turret.z + marked[2] }
  }
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
    y: turret.y + box.max.y + OPERATOR_EYE_ABOVE_GLASS_M,
    z: turret.z + (box.min.z + box.max.z) / 2,
  }
}

function isVec3Array(value: unknown): value is [number, number, number] {
  return Array.isArray(value) && value.length === 3 && value.every((item) => Number.isFinite(item))
}

function isGlass(mesh: Mesh): boolean {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
  return (
    CAB_GLASS_PATTERN.test(mesh.name) ||
    materials.some((material) => CAB_GLASS_PATTERN.test(material.name))
  )
}
