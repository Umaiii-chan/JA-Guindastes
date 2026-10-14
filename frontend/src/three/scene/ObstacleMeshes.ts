import {
  BoxGeometry,
  CylinderGeometry,
  EdgesGeometry,
  Group,
  Line,
  LineBasicMaterial,
  LineSegments,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  type Object3D,
  Points,
} from 'three'

import type { Obstacle } from '../../domain/environment/environment'
import {
  findLibraryObject,
  type LibraryObject,
  modelScale,
} from '../../domain/environment/objectLibrary'
import { disposeObject3D } from './disposeObject3D'
import { type ObjectModelCache, objectModels, SHARED_ASSET_KEY } from './ObjectModels'
import { EDITOR_COLORS, SCENE_COLORS } from './palette'

export const OBSTACLE_NAMES = Object.freeze({
  root: 'scenario-obstacles',
  /** Prefixo do grupo de cada obstáculo; o id vem depois (`scenario-obstacle-<id>`). */
  prefix: 'scenario-obstacle-',
})

/** Segmentos radiais do cilindro: o bastante para a silhueta ficar redonda sem pesar. */
const CYLINDER_SEGMENTS = 32

/** Nome do contorno de seleção de um objeto da biblioteca (TASK-072), escondido até o editor ligar. */
export const MODEL_SELECTION_OUTLINE = 'obstacle-selection-outline'
/** Nome do grupo que leva o modelo 3D (ou o bloco de espera enquanto o arquivo carrega). */
export const MODEL_VISUAL = 'obstacle-model'

/** Libera só o que o grupo possui: o modelo da biblioteca é compartilhado entre as cópias. */
function disposeOwned(root: Object3D): void {
  if (root.userData[SHARED_ASSET_KEY]) return
  if (root instanceof Mesh || root instanceof Line || root instanceof Points) {
    disposeObject3D(root)
    return
  }
  for (const child of root.children) disposeOwned(child)
}

/**
 * Obstáculos do cenário (TASK-052; ADR-023): caixas e cilindros apoiados no terreno, no mesmo papel
 * da carga (bloco claro com arestas em tinta). A base fica na altura do terreno no centro do
 * obstáculo (`CranePlacement`/`Obstacle` em `domain/environment`); o cilindro usa `widthM` como
 * diâmetro. São só desenho: as colisões são da TASK-053.
 */
export class ObstacleMeshes {
  readonly root = new Group()
  private readonly models: ObjectModelCache
  private onChange: (() => void) | null = null
  private generation = 0

  constructor(models: ObjectModelCache = objectModels) {
    this.root.name = OBSTACLE_NAMES.root
    this.models = models
  }

  /** Quem é avisado quando um modelo 3D termina de carregar e entra na cena (pede novo quadro). */
  setOnChange(callback: (() => void) | null): void {
    this.onChange = callback
  }

  /** Recria os obstáculos. `heightAt` dá a altura do terreno no centro de cada um. */
  setObstacles(obstacles: readonly Obstacle[], heightAt: (x: number, z: number) => number): void {
    this.clear()
    const generation = this.generation
    for (const obstacle of obstacles) {
      if (!(obstacle.widthM > 0 && obstacle.heightM > 0)) continue
      if (obstacle.kind !== 'cylinder' && !(obstacle.depthM > 0)) continue
      const object = obstacle.kind === 'model' ? findLibraryObject(obstacle.modelId) : undefined
      if (object) {
        this.root.add(this.buildModel(obstacle, object, heightAt, generation))
        continue
      }
      // Sem objeto da biblioteca (`modelId` desconhecido), o obstáculo volta a ser uma caixa.
      const geometry =
        obstacle.kind !== 'cylinder'
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

  /**
   * Objeto da biblioteca: o GLB na escala do obstáculo, assentado na altura do terreno no centro da
   * planta (a base fica em y = 0 do grupo). Enquanto o arquivo carrega, um bloco translúcido ocupa o
   * lugar; um contorno de seleção, escondido, fica à disposição do editor.
   */
  private buildModel(
    obstacle: Obstacle,
    object: LibraryObject,
    heightAt: (x: number, z: number) => number,
    generation: number,
  ): Group {
    const group = new Group()
    group.name = `${OBSTACLE_NAMES.prefix}${obstacle.id}`
    group.userData.obstacleId = obstacle.id
    group.userData.kind = 'model'
    group.position.set(
      obstacle.centerX,
      heightAt(obstacle.centerX, obstacle.centerZ),
      obstacle.centerZ,
    )
    group.rotation.y = MathUtils.degToRad(obstacle.rotationYDeg)

    const scale = modelScale(obstacle, object)
    const visual = new Group()
    visual.name = MODEL_VISUAL
    visual.scale.set(scale.x, scale.y, scale.z)
    group.add(visual)

    const { w, d, h } = object.baseSize
    const outline = new LineSegments(
      new EdgesGeometry(new BoxGeometry(w, h, d)),
      new LineBasicMaterial({
        color: EDITOR_COLORS.brush,
        depthTest: false,
        transparent: true,
      }),
    )
    outline.name = MODEL_SELECTION_OUTLINE
    outline.position.y = h / 2
    outline.scale.set(scale.x, scale.y, scale.z)
    outline.renderOrder = 999
    outline.visible = false
    group.add(outline)

    const ready = this.models.instance(object.id)
    if (ready) {
      visual.add(ready)
    } else {
      const placeholder = new Mesh(
        new BoxGeometry(w, h, d),
        new MeshBasicMaterial({ color: SCENE_COLORS.obstacle, transparent: true, opacity: 0.35 }),
      )
      placeholder.position.y = h / 2
      visual.add(placeholder)
      if (!this.models.hasFailed(object.id)) {
        void this.models.load(object).then((template) => {
          // A lista de obstáculos pode ter sido refeita (ou descartada) enquanto o arquivo carregava.
          if (!template || generation !== this.generation || group.parent !== this.root) return
          const copy = this.models.instance(object.id)
          if (!copy) return
          placeholder.removeFromParent()
          disposeObject3D(placeholder)
          visual.add(copy)
          this.onChange?.()
        })
      }
    }
    return group
  }

  get count(): number {
    return this.root.children.length
  }

  private clear(): void {
    this.generation += 1
    for (const child of [...this.root.children]) {
      child.removeFromParent()
      disposeOwned(child)
    }
  }

  dispose(): void {
    this.clear()
    this.root.removeFromParent()
  }
}
