import {
  BoxGeometry,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  MathUtils,
  Mesh,
  MeshLambertMaterial,
} from 'three'

import { disposeObject3D } from './disposeObject3D'
import type { LoadDimensions } from './loadBox'
import { SCENE_COLORS, STATUS_COLORS } from './palette'

export const GROUND_CARGO_NAMES = Object.freeze({
  root: 'ground-cargo',
})

/** Medidas do marcador provisório, quando ainda não há medidas da carga (m). */
export const PLACEHOLDER_CARGO_SIZE: LoadDimensions = { lengthM: 2, widthM: 1.5, heightM: 1.2 }

/**
 * Carga apoiada no chão (TASK-073; ADR-035): a caixa das medidas do passo "Carga", no mesmo papel da
 * carga pendurada (bloco claro com arestas em tinta), com a base na altura dada. Sem medidas, mostra
 * um marcador provisório translúcido. Só desenho: as colisões usam os mesmos dados em
 * `SceneCollisions`.
 */
export class GroundCargo {
  readonly root = new Group()

  private readonly material = new MeshLambertMaterial({ color: SCENE_COLORS.load })
  private readonly edgesMaterial = new LineBasicMaterial({ color: SCENE_COLORS.loadEdges })
  private group: Group | null = null

  constructor() {
    this.root.name = GROUND_CARGO_NAMES.root
    this.root.visible = false
  }

  /** Posiciona a caixa; `size` `null` mostra o marcador provisório; `pose` `null` esconde. */
  show(
    size: LoadDimensions | null,
    pose: { readonly x: number; readonly z: number; readonly rotationYDeg: number } | null,
    baseY: number,
    delivered = false,
  ): void {
    this.clear()
    if (!pose) {
      this.root.visible = false
      return
    }
    const placeholder = size === null
    const dims = size ?? PLACEHOLDER_CARGO_SIZE
    const geometry = new BoxGeometry(dims.widthM, dims.heightM, dims.lengthM)
    this.material.transparent = placeholder
    this.material.opacity = placeholder ? 0.5 : 1
    this.material.color.setHex(delivered ? 0xcfe3d2 : SCENE_COLORS.load)
    this.material.needsUpdate = true
    const mesh = new Mesh(geometry, this.material)
    mesh.castShadow = true
    mesh.receiveShadow = true
    const edges = new LineSegments(
      new EdgesGeometry(geometry),
      delivered ? this.deliveredEdgesMaterial : this.edgesMaterial,
    )
    const group = new Group()
    group.add(mesh, edges)
    group.position.set(pose.x, baseY + dims.heightM / 2, pose.z)
    group.rotation.y = MathUtils.degToRad(pose.rotationYDeg)
    this.root.add(group)
    this.group = group
    this.root.visible = true
  }

  private readonly deliveredEdgesMaterial = new LineBasicMaterial({ color: STATUS_COLORS.ok })

  get visible(): boolean {
    return this.root.visible
  }

  private clear(): void {
    if (!this.group) return
    this.group.removeFromParent()
    for (const child of this.group.children) {
      if (child instanceof Mesh || child instanceof LineSegments) child.geometry.dispose()
    }
    this.group = null
  }

  dispose(): void {
    this.clear()
    this.material.dispose()
    this.edgesMaterial.dispose()
    this.deliveredEdgesMaterial.dispose()
    this.root.removeFromParent()
    disposeObject3D(this.root)
  }
}
