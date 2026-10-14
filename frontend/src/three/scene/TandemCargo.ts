import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  EdgesGeometry,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
} from 'three'

import type { CargoPlacement } from '../../domain/environment/environment'
import {
  liftPointsWorld,
  type PlanPoint,
  type TandemLoad,
  type WorldPoint,
} from '../../domain/tandem/tandem'
import { type EvaluationStatus, SCENE_COLORS, STATUS_COLORS, statusColor } from './palette'

export const TANDEM_CARGO_NAMES = {
  root: 'tandem-cargo',
  box: 'tandem-cargo-box',
  slings: 'tandem-cargo-slings',
  marker: 'tandem-lift-marker',
} as const

/** Pose da carga içada: base, centro e giro (o que `tandemFrame` devolve). */
export interface HoistedCargoPose extends CargoPlacement {
  readonly bottomY: number
}

const DEG = Math.PI / 180

/**
 * Carga do içamento com dois guindastes (TASK-074): apoiada no chão com os dois pontos de içamento
 * marcados (antes do engate) ou içada, com as lingas ligando cada gancho à carga. Só desenho.
 */
export class TandemCargo {
  readonly root = new Group()

  private readonly boxMaterial = new MeshStandardMaterial({
    color: SCENE_COLORS.load,
    roughness: 0.9,
    metalness: 0,
  })
  private readonly edgesMaterial = new LineBasicMaterial({
    color: SCENE_COLORS.loadEdges,
    toneMapped: false,
  })
  private readonly slingMaterial = new LineBasicMaterial({
    color: SCENE_COLORS.sling,
    toneMapped: false,
  })
  private readonly markerMaterial = new MeshStandardMaterial({
    color: SCENE_COLORS.zoneSectorActive,
    roughness: 0.6,
  })
  private readonly markerGeometry = new CylinderGeometry(0.28, 0.28, 0.06, 20)
  private box: Mesh | null = null
  private edges: LineSegments | null = null
  private slings: LineSegments | null = null
  private markers: Mesh[] = []
  private load: TandemLoad | null = null
  private highlighted = false

  constructor() {
    this.root.name = TANDEM_CARGO_NAMES.root
    this.root.visible = false
  }

  get visible(): boolean {
    return this.root.visible
  }

  /** Carga apoiada em `groundY`, com um marcador em cada ponto de içamento. */
  showAtRest(
    cargo: CargoPlacement,
    load: TandemLoad,
    groundY: number,
    offsets?: readonly [PlanPoint, PlanPoint],
  ): void {
    this.ensureBox(load)
    this.place(cargo, groundY)
    this.setSlings(null)
    const points = liftPointsWorld(cargo, load, offsets)
    this.ensureMarkers(2)
    points.forEach((point, index) => {
      const marker = this.markers[index]
      marker?.position.set(point.x, groundY + load.heightM + 0.04, point.z)
      if (marker) marker.visible = true
    })
    this.root.visible = true
  }

  /** Carga içada na pose `cargo`, com as lingas partindo dos ganchos. */
  showHoisted(
    cargo: HoistedCargoPose,
    load: TandemLoad,
    hooks: readonly [WorldPoint, WorldPoint],
  ): void {
    this.ensureBox(load)
    this.place(cargo, cargo.bottomY)
    for (const marker of this.markers) marker.visible = false
    const top = cargo.bottomY + load.heightM
    const heading = cargo.rotationYDeg * DEG
    // Cada gancho prende em dois pontos da face de cima, afastados na largura (V de lingas).
    const spread = Math.min(load.widthM / 2, 1)
    const sideX = Math.cos(heading) * spread
    const sideZ = -Math.sin(heading) * spread
    const vertices: number[] = []
    for (const hook of hooks) {
      for (const sign of [-1, 1]) {
        vertices.push(hook.x, hook.y, hook.z, hook.x + sign * sideX, top, hook.z + sign * sideZ)
      }
    }
    this.setSlings(vertices)
    this.root.visible = true
  }

  hide(): void {
    this.root.visible = false
  }

  /** Contorno e lingas na cor da situação (verde, âmbar, vermelho ou cinza). */
  setStatus(status: EvaluationStatus): void {
    if (this.highlighted) return
    const color = statusColor(status)
    this.slingMaterial.color.setHex(status === 'unknown' ? SCENE_COLORS.sling : color)
    this.edgesMaterial.color.setHex(status === 'unknown' ? SCENE_COLORS.loadEdges : color)
  }

  /** Destaque vermelho da carga atingida (RN-012). */
  setCollisionHighlight(on: boolean): void {
    if (on === this.highlighted) return
    this.highlighted = on
    this.boxMaterial.color.setHex(on ? STATUS_COLORS.over : SCENE_COLORS.load)
    this.edgesMaterial.color.setHex(on ? STATUS_COLORS.over : SCENE_COLORS.loadEdges)
  }

  dispose(): void {
    this.clearBox()
    this.clearSlings()
    for (const marker of this.markers) marker.removeFromParent()
    this.markers = []
    this.markerGeometry.dispose()
    this.markerMaterial.dispose()
    this.boxMaterial.dispose()
    this.edgesMaterial.dispose()
    this.slingMaterial.dispose()
    this.root.removeFromParent()
  }

  private place(cargo: CargoPlacement, bottomY: number): void {
    const load = this.load
    if (!load || !this.box || !this.edges) return
    const y = bottomY + load.heightM / 2
    for (const part of [this.box, this.edges]) {
      part.position.set(cargo.x, y, cargo.z)
      part.rotation.set(0, cargo.rotationYDeg * DEG, 0)
    }
  }

  private ensureBox(load: TandemLoad): void {
    const same =
      this.load &&
      this.load.lengthM === load.lengthM &&
      this.load.widthM === load.widthM &&
      this.load.heightM === load.heightM
    this.load = load
    if (same && this.box) return
    this.clearBox()
    const geometry = new BoxGeometry(load.widthM, load.heightM, load.lengthM)
    this.box = new Mesh(geometry, this.boxMaterial)
    this.box.name = TANDEM_CARGO_NAMES.box
    this.box.castShadow = true
    this.box.receiveShadow = true
    this.edges = new LineSegments(new EdgesGeometry(geometry), this.edgesMaterial)
    this.root.add(this.box, this.edges)
  }

  private ensureMarkers(count: number): void {
    while (this.markers.length < count) {
      const marker = new Mesh(this.markerGeometry, this.markerMaterial)
      marker.name = TANDEM_CARGO_NAMES.marker
      this.markers.push(marker)
      this.root.add(marker)
    }
  }

  private setSlings(vertices: number[] | null): void {
    this.clearSlings()
    if (!vertices) return
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3))
    this.slings = new LineSegments(geometry, this.slingMaterial)
    this.slings.name = TANDEM_CARGO_NAMES.slings
    this.slings.frustumCulled = false
    this.root.add(this.slings)
  }

  private clearBox(): void {
    for (const part of [this.box, this.edges]) {
      if (!part) continue
      part.removeFromParent()
      if (part instanceof Mesh || part instanceof LineSegments) part.geometry.dispose()
    }
    this.box = null
    this.edges = null
  }

  private clearSlings(): void {
    if (!this.slings) return
    this.slings.removeFromParent()
    this.slings.geometry.dispose()
    this.slings = null
  }
}
