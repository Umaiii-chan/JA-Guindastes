import {
  BoxGeometry,
  CylinderGeometry,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  MathUtils,
  Mesh,
  MeshLambertMaterial,
} from 'three'

import type { Obstacle } from '../../domain/environment/environment'
import { disposeObject3D } from './disposeObject3D'
import { SCENE_COLORS } from './palette'

export const OBSTACLE_NAMES = Object.freeze({
  root: 'scenario-obstacles',
  /** Prefixo do grupo de cada obstáculo; o id vem depois (`scenario-obstacle-<id>`). */
  prefix: 'scenario-obstacle-',
})

/** Segmentos radiais do cilindro: o bastante para a silhueta ficar redonda sem pesar. */
const CYLINDER_SEGMENTS = 32

/**
 * Obstáculos do cenário (TASK-052; ADR-023): caixas e cilindros apoiados no terreno, no mesmo papel
 * da carga (bloco claro com arestas em tinta). A base fica na altura do terreno no centro do
 * obstáculo (`CranePlacement`/`Obstacle` em `domain/environment`); o cilindro usa `widthM` como
 * diâmetro. São só desenho: as colisões são da TASK-053.
 */
export class ObstacleMeshes {
  readonly root = new Group()

  constructor() {
    this.root.name = OBSTACLE_NAMES.root
  }

  /** Recria os obstáculos. `heightAt` dá a altura do terreno no centro de cada um. */
  setObstacles(obstacles: readonly Obstacle[], heightAt: (x: number, z: number) => number): void {
    this.clear()
    for (const obstacle of obstacles) {
      if (!(obstacle.widthM > 0 && obstacle.heightM > 0)) continue
      if (obstacle.kind === 'box' && !(obstacle.depthM > 0)) continue
      const geometry =
        obstacle.kind === 'box'
          ? new BoxGeometry(obstacle.widthM, obstacle.heightM, obstacle.depthM)
          : new CylinderGeometry(
              obstacle.widthM / 2,
              obstacle.widthM / 2,
              obstacle.heightM,
              CYLINDER_SEGMENTS,
            )
      const mesh = new Mesh(geometry, new MeshLambertMaterial({ color: SCENE_COLORS.obstacle }))
      mesh.castShadow = true
      mesh.receiveShadow = true
      const edges = new LineSegments(
        new EdgesGeometry(geometry, 30),
        new LineBasicMaterial({ color: SCENE_COLORS.obstacleEdges }),
      )
      const group = new Group()
      group.name = `${OBSTACLE_NAMES.prefix}${obstacle.id}`
      group.userData.obstacleId = obstacle.id
      group.add(mesh, edges)
      const base = heightAt(obstacle.centerX, obstacle.centerZ)
      group.position.set(obstacle.centerX, base + obstacle.heightM / 2, obstacle.centerZ)
      group.rotation.y = MathUtils.degToRad(obstacle.rotationYDeg)
      this.root.add(group)
    }
  }

  get count(): number {
    return this.root.children.length
  }

  private clear(): void {
    for (const child of [...this.root.children]) {
      child.removeFromParent()
      disposeObject3D(child)
    }
  }

  dispose(): void {
    this.clear()
    this.root.removeFromParent()
  }
}
