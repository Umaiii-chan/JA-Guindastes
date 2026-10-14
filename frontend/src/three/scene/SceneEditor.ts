import {
  BufferGeometry,
  Float32BufferAttribute,
  LineBasicMaterial,
  LineLoop,
  type Mesh,
  type MeshLambertMaterial,
  Object3D,
  type PerspectiveCamera,
  Raycaster,
  type Scene,
  Vector2,
  type Vector3,
} from 'three'
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { TransformControls } from 'three/addons/controls/TransformControls.js'

import {
  addObstacleAt,
  type Brush,
  flattenAt,
  levelAt,
  paintSoil,
  sculptAt,
} from '../../application/environment/editorOps'
import type { Obstacle, ScenarioSpec, SoilKind } from '../../domain/environment/environment'
import type { CraneSceneContents } from './buildCraneScene'
import { OBSTACLE_NAMES } from './ObstacleMeshes'
import { EDITOR_COLORS, SOIL_COLORS } from './palette'

// Editor 3D do ambiente (TASK-066; ADR-032): seleção e arrasto de obstáculos e do guindaste com
// TransformControls, obstáculos novos, pincel de terreno, aplainar e pintura de solo, tudo por
// raycast no chão. A cena não guarda o cenário: lê por `getSpec()` e devolve cada mudança por
// `onChange` (o cenário fica na UI, com o desfazer).

export type EditorTool = 'select' | 'add-box' | 'add-cylinder' | 'sculpt' | 'flatten' | 'paint'
export type EditorTransformMode = 'translate' | 'rotate' | 'scale'

/** Id da seleção quando o objeto escolhido é o guindaste. */
export const CRANE_SELECTION_ID = 'crane'

export interface SceneEditorConfig {
  readonly tool: EditorTool
  readonly transformMode: EditorTransformMode
  readonly brush: Brush
  readonly soilKind: SoilKind
  /** Esculpir desce em vez de subir (Shift faz o mesmo no momento do clique). */
  readonly lowerTerrain: boolean
  /** Id do obstáculo selecionado, `CRANE_SELECTION_ID` ou `null`. */
  readonly selectedId: string | null
}

export interface SceneEditorCallbacks {
  getSpec(): ScenarioSpec
  onChange(spec: ScenarioSpec): void
  /** Chamado antes de cada gesto que altera o cenário (ponto de desfazer). */
  onCheckpoint(): void
  onSelect(id: string | null): void
  /** O editor pede outra ferramenta (depois de adicionar um obstáculo, volta a "selecionar"). */
  onToolChange(tool: EditorTool): void
}

export interface SceneEditorDeps {
  readonly scene: Scene
  readonly camera: PerspectiveCamera
  readonly domElement: HTMLElement
  /** Ancestral do canvas que recebe os eventos primeiro (fase de captura). */
  readonly container: HTMLElement
  readonly controls: OrbitControls
  readonly contents: CraneSceneContents
  readonly invalidate: () => void
}

const CLICK_MAX_MOVE_PX = 5
const CLICK_MAX_MS = 600
/** Espaçamento mínimo entre pinceladas de um arrasto, como fração do raio do pincel. */
const DAB_SPACING = 0.35
const MIN_OBSTACLE_SIZE_M = 0.2
const CURSOR_POINTS = 64
const SELECTED_COLOR = 0xf0c7b0

/** Rumo (graus) de uma rotação só em torno de Y, a partir do quaternion (sem o salto de Euler). */
function yawDeg(object: Object3D): number {
  const q = object.quaternion
  return normalizeDeg((2 * Math.atan2(q.y, q.w) * 180) / Math.PI)
}

function normalizeDeg(deg: number): number {
  const wrapped = ((((deg + 180) % 360) + 360) % 360) - 180
  return Math.round(wrapped * 100) / 100
}

const round2 = (value: number): number => Math.round(value * 100) / 100

export class SceneEditor {
  private readonly deps: SceneEditorDeps
  private readonly transform: TransformControls
  private readonly pivot = new Object3D()
  private readonly raycaster = new Raycaster()
  private readonly cursor: LineLoop
  private config: SceneEditorConfig | null = null
  private callbacks: SceneEditorCallbacks | null = null

  private stroke: { lastX: number; lastZ: number; level: number } | null = null
  private pending: { x: number; z: number; lower: boolean } | null = null
  private frame = 0
  private pressed: { x: number; y: number; time: number; onGizmo: boolean } | null = null
  private cursorRadius = 0
  private disposed = false
  private readonly savedRightButton: number

  constructor(deps: SceneEditorDeps) {
    this.deps = deps
    this.savedRightButton = deps.controls.mouseButtons.RIGHT as number
    this.pivot.name = 'editor-crane-pivot'
    deps.scene.add(this.pivot)

    this.transform = new TransformControls(deps.camera, deps.domElement)
    this.transform.setSize(0.9)
    const helper = this.transform.getHelper()
    helper.name = 'editor-transform-gizmo'
    deps.scene.add(helper)
    this.transform.addEventListener('dragging-changed', (event) => {
      const dragging = (event as unknown as { value: boolean }).value
      deps.controls.enabled = !dragging
      if (dragging) this.callbacks?.onCheckpoint()
      else this.commitTransform()
    })
    this.transform.addEventListener('objectChange', () => this.liveTransform())
    this.transform.addEventListener('change', () => deps.invalidate())

    const cursorGeometry = new BufferGeometry()
    cursorGeometry.setAttribute(
      'position',
      new Float32BufferAttribute(new Float32Array(CURSOR_POINTS * 3), 3),
    )
    this.cursor = new LineLoop(
      cursorGeometry,
      new LineBasicMaterial({ color: EDITOR_COLORS.brush, depthTest: false, transparent: true }),
    )
    this.cursor.name = 'editor-brush-cursor'
    this.cursor.renderOrder = 999
    this.cursor.visible = false
    this.cursor.frustumCulled = false
    deps.scene.add(this.cursor)

    deps.container.addEventListener('pointerdown', this.onPointerDown, true)
    deps.container.addEventListener('pointermove', this.onPointerMove, true)
    deps.container.addEventListener('pointerup', this.onPointerUp, true)
    deps.container.addEventListener('pointercancel', this.onPointerUp, true)
    deps.container.addEventListener('pointerleave', this.onPointerLeave)
  }

  configure(config: SceneEditorConfig, callbacks: SceneEditorCallbacks): void {
    if (this.disposed) return
    const previousTool = this.config?.tool
    this.config = config
    this.callbacks = callbacks
    const brushTool = this.isBrushTool(config.tool)
    // Com o pincel, o botão direito gira a câmera (o esquerdo esculpe); Alt + esquerdo também gira.
    this.deps.controls.mouseButtons.RIGHT = brushTool ? 0 : this.savedRightButton
    if (previousTool !== config.tool) {
      this.cursor.visible = false
      this.cursorRadius = 0
    }
    this.syncSelection()
    this.deps.invalidate()
  }

  /** Depois de a cena refazer obstáculos e guindaste: religa o gizmo ao objeto novo. */
  refresh(): void {
    if (this.disposed || this.transform.dragging) return
    this.syncSelection()
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    cancelAnimationFrame(this.frame)
    const { container, controls, scene } = this.deps
    container.removeEventListener('pointerdown', this.onPointerDown, true)
    container.removeEventListener('pointermove', this.onPointerMove, true)
    container.removeEventListener('pointerup', this.onPointerUp, true)
    container.removeEventListener('pointercancel', this.onPointerUp, true)
    container.removeEventListener('pointerleave', this.onPointerLeave)
    controls.enabled = true
    controls.mouseButtons.RIGHT = this.savedRightButton as typeof controls.mouseButtons.RIGHT
    this.transform.detach()
    scene.remove(this.transform.getHelper())
    this.transform.dispose()
    scene.remove(this.pivot)
    scene.remove(this.cursor)
    this.cursor.geometry.dispose()
    ;(this.cursor.material as LineBasicMaterial).dispose()
    this.deps.invalidate()
  }

  // --- seleção e gizmo ---------------------------------------------------------------------------

  private isBrushTool(tool: EditorTool): boolean {
    return tool === 'sculpt' || tool === 'flatten' || tool === 'paint'
  }

  private obstacleGroup(id: string): Object3D | undefined {
    return this.deps.contents.obstacles.root.getObjectByName(`${OBSTACLE_NAMES.prefix}${id}`)
  }

  private findObstacle(id: string): Obstacle | undefined {
    return this.callbacks?.getSpec().obstacles.find((obstacle) => obstacle.id === id)
  }

  private syncSelection(): void {
    const config = this.config
    // Realça o obstáculo escolhido (as malhas são refeitas a cada mudança, então é refeito aqui).
    for (const group of this.deps.contents.obstacles.root.children) {
      const mesh = group.children[0] as Mesh | undefined
      const material = mesh?.material as MeshLambertMaterial | undefined
      if (!material) continue
      const selected = config?.tool === 'select' && group.userData.obstacleId === config.selectedId
      material.color.setHex(selected ? SELECTED_COLOR : 0xd8d2c1)
    }
    if (!config || config.tool !== 'select' || config.selectedId === null) {
      this.transform.detach()
      return
    }
    let target: Object3D | undefined
    if (config.selectedId === CRANE_SELECTION_ID) {
      const { x, z, headingDeg } = this.callbacks?.getSpec().crane ?? { x: 0, z: 0, headingDeg: 0 }
      const anchor = this.deps.contents.craneAnchor
      this.pivot.position.set(x, anchor.position.y, z)
      this.pivot.rotation.set(0, (headingDeg * Math.PI) / 180, 0)
      this.pivot.scale.set(1, 1, 1)
      target = this.pivot
    } else {
      target = this.obstacleGroup(config.selectedId)
    }
    if (!target) {
      this.transform.detach()
      return
    }
    const crane = config.selectedId === CRANE_SELECTION_ID
    // O guindaste só anda e gira; escala só vale para obstáculos.
    const mode = crane && config.transformMode === 'scale' ? 'translate' : config.transformMode
    this.transform.setMode(mode)
    this.transform.setSpace(mode === 'scale' ? 'local' : 'world')
    this.transform.showX = mode !== 'rotate'
    this.transform.showY = mode === 'scale'
    this.transform.showZ = mode !== 'rotate'
    if (mode === 'rotate') this.transform.showY = true
    if (this.transform.object !== target) this.transform.attach(target)
    this.deps.invalidate()
  }

  /** Movimento ao vivo: assenta o obstáculo no terreno ou o guindaste na nova posição. */
  private liveTransform(): void {
    const object = this.transform.object
    const config = this.config
    const callbacks = this.callbacks
    if (!object || !config || !callbacks) return
    const spec = callbacks.getSpec()
    const { contents } = this.deps
    if (config.selectedId === CRANE_SELECTION_ID) {
      const crane = {
        x: round2(object.position.x),
        z: round2(object.position.z),
        headingDeg: yawDeg(object),
      }
      object.position.y = contents.environment.heightAt(crane.x, crane.z)
      contents.setScenario({ ...spec, crane })
      this.deps.invalidate()
      return
    }
    const obstacle = config.selectedId === null ? undefined : this.findObstacle(config.selectedId)
    if (!obstacle) return
    if (obstacle.kind === 'cylinder') object.scale.z = object.scale.x
    const base = contents.environment.heightAt(object.position.x, object.position.z)
    object.position.y = base + (obstacle.heightM * object.scale.y) / 2
    this.deps.invalidate()
  }

  /** Fim do arrasto: grava a posição, o giro ou o tamanho no cenário. */
  private commitTransform(): void {
    const object = this.transform.object
    const config = this.config
    const callbacks = this.callbacks
    if (!object || !config || !callbacks) return
    const spec = callbacks.getSpec()
    if (config.selectedId === CRANE_SELECTION_ID) {
      callbacks.onChange({
        ...spec,
        crane: {
          x: round2(object.position.x),
          z: round2(object.position.z),
          headingDeg: yawDeg(object),
        },
      })
      return
    }
    const obstacle = config.selectedId === null ? undefined : this.findObstacle(config.selectedId)
    if (!obstacle) return
    const size = (value: number, factor: number) =>
      Math.max(MIN_OBSTACLE_SIZE_M, round2(value * Math.abs(factor)))
    const widthM = size(obstacle.widthM, object.scale.x)
    const next: Obstacle = {
      ...obstacle,
      centerX: round2(object.position.x),
      centerZ: round2(object.position.z),
      rotationYDeg: yawDeg(object),
      widthM,
      depthM: obstacle.kind === 'cylinder' ? widthM : size(obstacle.depthM, object.scale.z),
      heightM: size(obstacle.heightM, object.scale.y),
    }
    callbacks.onChange({
      ...spec,
      obstacles: spec.obstacles.map((item) => (item.id === obstacle.id ? next : item)),
    })
  }

  // --- ponteiro ----------------------------------------------------------------------------------

  private aim(event: PointerEvent): void {
    const rect = this.deps.domElement.getBoundingClientRect()
    const ndc = new Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    )
    this.raycaster.setFromCamera(ndc, this.deps.camera)
  }

  private groundUnder(event: PointerEvent): Vector3 | null {
    this.aim(event)
    return this.deps.contents.environment.pickGround(this.raycaster)
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    const config = this.config
    if (this.disposed || !config || event.button !== 0 || event.altKey) return
    this.pressed = {
      x: event.clientX,
      y: event.clientY,
      time: performance.now(),
      onGizmo: this.transform.axis !== null,
    }
    if (!this.isBrushTool(config.tool) || this.pressed.onGizmo) return
    const point = this.groundUnder(event)
    if (!point) return
    // Começa a pincelada: a órbita não vê este clique.
    event.stopPropagation()
    event.preventDefault()
    this.deps.controls.enabled = false
    try {
      this.deps.domElement.setPointerCapture(event.pointerId)
    } catch {
      // O ponteiro pode já ter sido solto; a pincelada segue sem captura.
    }
    this.callbacks?.onCheckpoint()
    const spec = this.callbacks?.getSpec()
    this.stroke = {
      lastX: Number.NEGATIVE_INFINITY,
      lastZ: Number.NEGATIVE_INFINITY,
      level: spec ? levelAt(spec, point.x, point.z) : 0,
    }
    this.dab(point.x, point.z, event.shiftKey)
  }

  private readonly onPointerMove = (event: PointerEvent): void => {
    const config = this.config
    if (this.disposed || !config) return
    if (this.stroke) {
      const point = this.groundUnder(event)
      if (!point) return
      this.pending = { x: point.x, z: point.z, lower: event.shiftKey }
      if (!this.frame) {
        this.frame = requestAnimationFrame(() => {
          this.frame = 0
          const next = this.pending
          this.pending = null
          if (next && this.stroke) this.dab(next.x, next.z, next.lower)
        })
      }
      this.moveCursor(point)
      return
    }
    if (this.isBrushTool(config.tool) && event.buttons === 0) {
      const point = this.groundUnder(event)
      if (point) this.moveCursor(point)
      else if (this.cursor.visible) {
        this.cursor.visible = false
        this.deps.invalidate()
      }
    }
  }

  private readonly onPointerLeave = (): void => {
    if (this.cursor.visible && !this.stroke) {
      this.cursor.visible = false
      this.deps.invalidate()
    }
  }

  private readonly onPointerUp = (event: PointerEvent): void => {
    const config = this.config
    if (this.disposed || !config) return
    if (this.stroke) {
      this.stroke = null
      this.pending = null
      this.deps.controls.enabled = true
      try {
        this.deps.domElement.releasePointerCapture(event.pointerId)
      } catch {
        // Já solto.
      }
      this.pressed = null
      return
    }
    const pressed = this.pressed
    this.pressed = null
    if (!pressed || pressed.onGizmo || event.type === 'pointercancel') return
    const moved = Math.hypot(event.clientX - pressed.x, event.clientY - pressed.y)
    if (moved > CLICK_MAX_MOVE_PX || performance.now() - pressed.time > CLICK_MAX_MS) return
    if (config.tool === 'select') this.pick(event)
    else if (config.tool === 'add-box' || config.tool === 'add-cylinder') this.addAt(event)
  }

  // --- ferramentas -------------------------------------------------------------------------------

  private pick(event: PointerEvent): void {
    this.aim(event)
    const { contents } = this.deps
    const obstacleHit = this.raycaster.intersectObjects(contents.obstacles.root.children, true)[0]
    const craneHit = this.raycaster.intersectObject(contents.rig.base, true)[0]
    let selected: string | null = null
    if (obstacleHit && (!craneHit || obstacleHit.distance <= craneHit.distance)) {
      let node: Object3D | null = obstacleHit.object
      while (node && node.userData.obstacleId === undefined) node = node.parent
      selected = node ? (node.userData.obstacleId as string) : null
    } else if (craneHit) {
      selected = CRANE_SELECTION_ID
    }
    this.callbacks?.onSelect(selected)
  }

  private addAt(event: PointerEvent): void {
    const point = this.groundUnder(event)
    const callbacks = this.callbacks
    const config = this.config
    if (!point || !callbacks || !config) return
    const kind = config.tool === 'add-box' ? 'box' : 'cylinder'
    const added = addObstacleAt(callbacks.getSpec(), kind, point.x, point.z)
    if (added.id === null) return
    callbacks.onCheckpoint()
    callbacks.onChange(added.spec)
    callbacks.onSelect(added.id)
    callbacks.onToolChange('select')
  }

  /** Uma pincelada em (x, z), se andou o bastante desde a anterior. */
  private dab(x: number, z: number, lower: boolean): void {
    const config = this.config
    const callbacks = this.callbacks
    const stroke = this.stroke
    if (!config || !callbacks || !stroke) return
    const radius = config.brush.radiusM
    if (Math.hypot(x - stroke.lastX, z - stroke.lastZ) < radius * DAB_SPACING) return
    stroke.lastX = x
    stroke.lastZ = z
    const spec = callbacks.getSpec()
    let next = spec
    if (config.tool === 'sculpt') {
      const down = config.lowerTerrain || lower
      next = sculptAt(spec, x, z, radius, (down ? -1 : 1) * config.brush.intensityM)
    } else if (config.tool === 'flatten') {
      next = flattenAt(spec, x, z, radius, stroke.level)
    } else if (config.tool === 'paint') {
      next = paintSoil(spec, config.soilKind, x, z, radius)
    }
    if (next !== spec) callbacks.onChange(next)
    this.moveCursor({ x, z } as Vector3)
  }

  private moveCursor(point: { x: number; z: number }): void {
    const config = this.config
    if (!config) return
    const radius = config.brush.radiusM
    const { environment } = this.deps.contents
    const position = this.cursor.geometry.getAttribute('position')
    for (let i = 0; i < CURSOR_POINTS; i += 1) {
      const angle = (i / CURSOR_POINTS) * Math.PI * 2
      const x = point.x + Math.cos(angle) * radius
      const z = point.z + Math.sin(angle) * radius
      position.setXYZ(i, x, environment.heightAt(x, z) + 0.08, z)
    }
    position.needsUpdate = true
    this.cursorRadius = radius
    ;(this.cursor.material as LineBasicMaterial).color.setHex(
      config.tool === 'paint' ? SOIL_COLORS[config.soilKind] : EDITOR_COLORS.brush,
    )
    this.cursor.visible = true
    this.deps.invalidate()
  }

  /** Raio do cursor desenhado agora (m); para testes. */
  get cursorRadiusM(): number {
    return this.cursorRadius
  }
}
