import {
  BoxGeometry,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  Quaternion,
  Vector3,
} from 'three'

import type { CollisionState } from '../../domain/collision/collisions'
import type { Obb } from '../../domain/collision/obb'
import { STATUS_COLORS } from './palette'

// Destaque vermelho do que a carga atingiu (TASK-053; RN-012): contorno vermelho em volta do obstáculo
// ou da peça do guindaste atingida. A carga em si é pintada por `HookLoad.setCollisionHighlight`; o
// terreno só avisa pela carga e pela mensagem, porque o desenho dele é da TASK-052.

export const COLLISION_HIGHLIGHT_NAME = 'collision-highlight'

/** Folga do contorno em volta da caixa (m), para não ficar dentro das faces. */
const OUTLINE_MARGIN_M = 0.05

export class CollisionHighlight {
  readonly root = new Group()

  private readonly material = new LineBasicMaterial({
    color: STATUS_COLORS.over,
    toneMapped: false,
    depthTest: false,
    transparent: true,
  })
  private readonly unitEdges = new EdgesGeometry(new BoxGeometry(1, 1, 1))
  private outlines: LineSegments[] = []

  constructor() {
    this.root.name = COLLISION_HIGHLIGHT_NAME
    this.root.renderOrder = 10
  }

  /** Quantos contornos estão desenhados agora. */
  get outlineCount(): number {
    return this.outlines.length
  }

  /** Contorna as caixas atingidas (obstáculos e peças do guindaste); sem elas, apaga. */
  show(state: CollisionState): void {
    const boxes: Obb[] = []
    for (const hit of state.hits) {
      if ('obb' in hit.target) boxes.push(hit.target.obb)
    }
    this.clear()
    for (const obb of boxes) {
      const outline = new LineSegments(this.unitEdges, this.material)
      const [ax, ay, az] = obb.axes
      const matrix = new Matrix4().makeBasis(
        new Vector3(ax.x, ax.y, ax.z),
        new Vector3(ay.x, ay.y, ay.z),
        new Vector3(az.x, az.y, az.z),
      )
      outline.quaternion.copy(new Quaternion().setFromRotationMatrix(matrix))
      outline.position.set(obb.center.x, obb.center.y, obb.center.z)
      outline.scale.set(
        2 * obb.half.x + OUTLINE_MARGIN_M,
        2 * obb.half.y + OUTLINE_MARGIN_M,
        2 * obb.half.z + OUTLINE_MARGIN_M,
      )
      outline.renderOrder = 10
      this.root.add(outline)
      this.outlines.push(outline)
    }
  }

  clear(): void {
    for (const outline of this.outlines) outline.removeFromParent()
    this.outlines = []
  }

  dispose(): void {
    this.clear()
    this.unitEdges.dispose()
    this.material.dispose()
    this.root.removeFromParent()
  }
}
