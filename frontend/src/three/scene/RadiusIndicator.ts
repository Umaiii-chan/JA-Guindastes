import {
  BufferGeometry,
  Color,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  RingGeometry,
  CircleGeometry,
  Vector3,
} from 'three'

import type { CraneGeometryParameters } from '../../domain/geometry/operationalGeometry'
import type { CraneLimits } from '../crane/types'
import { type EvaluationStatus, SCENE_COLORS, statusColor } from './palette'
import {
  arcPoints,
  arcSegments,
  computeReachRange,
  computeTurretSweep,
  formatRadiusLabel,
  pointAtRadius,
  radiusLabelPosition,
  type ReachRange,
} from './radiusGeometry'

// Anel de raio de trabalho, arco de alcance e rótulo no chão (TASK-041). PRÉ-VISUALIZAÇÃO: o raio
// vem de `CraneController.getOperationalGeometry()` (ADR-013 C-5); o valor oficial é o do backend
// (ADR-013 C-7; RN-008).

/** Largura da faixa do anel (m) e da faixa de brilho ao redor dele. */
export const RING_WIDTH_M = 0.14
export const RING_GLOW_WIDTH_M = 0.9
/** Altura das marcas sobre o chão (m), para não disputarem profundidade com a grade. */
const MARK_Y = 0.015
/** Mudança de raio (m) abaixo da qual o anel não é refeito. */
const RADIUS_EPSILON_M = 1e-4
const RING_SEGMENTS = 128

export const RADIUS_INDICATOR_NAMES = {
  root: 'radius-indicator',
  ring: 'radius-ring',
  ringGlow: 'radius-ring-glow',
  radial: 'radius-radial-line',
  hookMark: 'radius-hook-mark',
  reachMin: 'reach-arc-min',
  reachMax: 'reach-arc-max',
  reachEdges: 'reach-arc-edges',
  labelAnchor: 'radius-label-anchor',
} as const

/** Estado mínimo do guindaste que o anel usa (vem do `CraneController`). */
export interface RadiusIndicatorInput {
  readonly workingRadiusM: number | null
  readonly turretRotationDeg: number
}

function flatRing(inner: number, outer: number): RingGeometry {
  const geometry = new RingGeometry(Math.max(0, inner), outer, RING_SEGMENTS, 1)
  // RingGeometry nasce no plano XY; deitada no chão (XZ), com a face para cima.
  geometry.rotateX(-Math.PI / 2)
  return geometry
}

function groundLine(points: readonly { x: number; z: number }[]): BufferGeometry {
  return new BufferGeometry().setFromPoints(points.map((p) => new Vector3(p.x, MARK_Y, p.z)))
}

export class RadiusIndicator {
  readonly root = new Group()
  /** Onde a camada HTML pendura o rótulo (CSS2D); acompanha o anel. */
  readonly labelAnchor = new Object3D()
  readonly reach: ReachRange

  private readonly ring: Mesh<RingGeometry, MeshBasicMaterial>
  private readonly ringGlow: Mesh<RingGeometry, MeshBasicMaterial>
  private readonly radial: Line<BufferGeometry, LineBasicMaterial>
  private readonly hookMark: Mesh<CircleGeometry, MeshBasicMaterial>
  private radiusM: number | null = null
  private turretRotationDeg = Number.NaN
  private status: EvaluationStatus = 'unknown'
  private label = ''

  constructor(limits: CraneLimits, geometryParameters: CraneGeometryParameters) {
    this.root.name = RADIUS_INDICATOR_NAMES.root
    this.labelAnchor.name = RADIUS_INDICATOR_NAMES.labelAnchor
    this.reach = computeReachRange(limits, geometryParameters)

    const color = new Color(statusColor(this.status))
    this.ring = new Mesh(
      flatRing(0, RING_WIDTH_M),
      new MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
        toneMapped: false,
        fog: false,
      }),
    )
    this.ring.name = RADIUS_INDICATOR_NAMES.ring
    this.ring.position.y = MARK_Y
    this.ring.renderOrder = 2

    this.ringGlow = new Mesh(
      flatRing(0, RING_GLOW_WIDTH_M),
      new MeshBasicMaterial({
        color: color.clone(),
        transparent: true,
        opacity: 0.1,
        depthWrite: false,
        toneMapped: false,
        fog: false,
      }),
    )
    this.ringGlow.name = RADIUS_INDICATOR_NAMES.ringGlow
    this.ringGlow.position.y = MARK_Y * 0.5
    this.ringGlow.renderOrder = 1

    this.radial = new Line(
      groundLine([
        { x: 0, z: 0 },
        { x: 0, z: 1 },
      ]),
      new LineBasicMaterial({
        color: color.clone(),
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
        toneMapped: false,
      }),
    )
    this.radial.name = RADIUS_INDICATOR_NAMES.radial
    this.radial.renderOrder = 2

    const hookMarkGeometry = new CircleGeometry(0.28, 24)
    hookMarkGeometry.rotateX(-Math.PI / 2)
    this.hookMark = new Mesh(
      hookMarkGeometry,
      new MeshBasicMaterial({
        color: color.clone(),
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        toneMapped: false,
      }),
    )
    this.hookMark.name = RADIUS_INDICATOR_NAMES.hookMark
    this.hookMark.position.y = MARK_Y * 1.5
    this.hookMark.renderOrder = 3

    this.root.add(this.ringGlow, this.ring, this.radial, this.hookMark, this.labelAnchor)
    this.addReachArcs(limits)
    this.setVisible(false)
  }

  /** Raio atual desenhado (m), ou `null` quando o anel está oculto (R < 0, ADR-013 C-5). */
  get currentRadiusM(): number | null {
    return this.radiusM
  }

  get currentStatus(): EvaluationStatus {
    return this.status
  }

  /** Texto do rótulo (`R 8,63 m`), ou vazio com o anel oculto. */
  get labelText(): string {
    return this.label
  }

  /**
   * Redesenha o anel para o estado do guindaste. Devolve `true` se algo mudou (raio ou giro), para
   * quem mantém o rótulo HTML atualizar o texto só quando precisa.
   */
  update(input: RadiusIndicatorInput): boolean {
    const radius = input.workingRadiusM
    const sameRadius =
      radius === null
        ? this.radiusM === null
        : this.radiusM !== null && Math.abs(radius - this.radiusM) < RADIUS_EPSILON_M
    const sameTurret = input.turretRotationDeg === this.turretRotationDeg
    if (sameRadius && sameTurret) return false

    this.turretRotationDeg = input.turretRotationDeg
    if (radius === null || !Number.isFinite(radius)) {
      this.radiusM = null
      this.label = ''
      this.setVisible(false)
      return true
    }

    if (!sameRadius) {
      this.radiusM = radius
      this.label = formatRadiusLabel(radius)
      this.replaceGeometry(
        this.ring,
        flatRing(radius - RING_WIDTH_M / 2, radius + RING_WIDTH_M / 2),
      )
      this.replaceGeometry(
        this.ringGlow,
        flatRing(radius - RING_GLOW_WIDTH_M / 2, radius + RING_GLOW_WIDTH_M / 2),
      )
    }

    const end = pointAtRadius(radius, input.turretRotationDeg)
    const position = this.radial.geometry.getAttribute('position')
    position.setXYZ(1, end.x, MARK_Y, end.z)
    position.needsUpdate = true
    this.radial.geometry.computeBoundingSphere()
    this.hookMark.position.set(end.x, MARK_Y * 1.5, end.z)
    const labelAt = radiusLabelPosition(radius, input.turretRotationDeg)
    this.labelAnchor.position.set(labelAt.x, 0.05, labelAt.z)
    this.setVisible(true)
    return true
  }

  /** Pinta o anel, a linha radial e a marca do gancho com a cor da situação. */
  setStatus(status: EvaluationStatus): void {
    this.status = status
    const color = statusColor(status)
    for (const mesh of [this.ring, this.ringGlow, this.radial, this.hookMark]) {
      mesh.material.color.setHex(color)
    }
  }

  private setVisible(visible: boolean): void {
    this.ring.visible = visible
    this.ringGlow.visible = visible
    this.radial.visible = visible
    this.hookMark.visible = visible
    this.labelAnchor.visible = visible
  }

  private replaceGeometry(
    mesh: Mesh<RingGeometry, MeshBasicMaterial>,
    geometry: RingGeometry,
  ): void {
    mesh.geometry.dispose()
    mesh.geometry = geometry
  }

  /** Arcos tênues do raio mínimo e máximo, na faixa de giro da torre, fixos para a configuração. */
  private addReachArcs(limits: CraneLimits): void {
    const sweep = computeTurretSweep(limits.turretRotationDeg)
    const segments = arcSegments(sweep.startDeg, sweep.endDeg)
    const material = new LineBasicMaterial({
      color: SCENE_COLORS.reachArc,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
    })

    const arcs: [string, number][] = [
      [RADIUS_INDICATOR_NAMES.reachMin, this.reach.minM],
      [RADIUS_INDICATOR_NAMES.reachMax, this.reach.maxM],
    ]
    for (const [name, radius] of arcs) {
      if (!(radius > 0)) continue
      const line = new Line(
        groundLine(arcPoints(radius, sweep.startDeg, sweep.endDeg, segments)),
        material,
      )
      line.name = name
      this.root.add(line)
    }

    // Com giro limitado, fecha o setor com os dois raios das pontas.
    if (!sweep.full && this.reach.maxM > this.reach.minM) {
      const edges = new Line(
        groundLine([
          pointAtRadius(this.reach.minM, sweep.startDeg),
          pointAtRadius(this.reach.maxM, sweep.startDeg),
        ]),
        material,
      )
      edges.name = RADIUS_INDICATOR_NAMES.reachEdges
      const otherEdge = new Line(
        groundLine([
          pointAtRadius(this.reach.minM, sweep.endDeg),
          pointAtRadius(this.reach.maxM, sweep.endDeg),
        ]),
        material,
      )
      otherEdge.name = RADIUS_INDICATOR_NAMES.reachEdges
      this.root.add(edges, otherEdge)
    }
  }
}
