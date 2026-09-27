import {
  BufferGeometry,
  Color,
  Group,
  Line,
  LineDashedMaterial,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  RingGeometry,
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

// Anel de raio de trabalho, arco de alcance e rótulo no chão (TASK-041), em traço de tinta (TASK-047;
// ADR-019): anel fino na cor da situação, sem brilho; linha radial e arcos de alcance tracejados.
// PRÉ-VISUALIZAÇÃO: o raio vem de `CraneController.getOperationalGeometry()` (ADR-013 C-5); o valor
// oficial é o do backend (ADR-013 C-7; RN-008).

/** Largura do traço do anel (m): fino, como uma linha de desenho. */
export const RING_WIDTH_M = 0.1
/** Marca no pé do gancho: anel pequeno, como marca de centro (raios interno e externo, m). */
const HOOK_MARK_RADII_M = { inner: 0.2, outer: 0.3 } as const
/** Traço e falha (m) da linha radial (linha de cota) e dos arcos de alcance (linha fantasma). */
const RADIAL_DASH_M = { dash: 0.5, gap: 0.3 } as const
const REACH_DASH_M = { dash: 1.2, gap: 0.6 } as const
/** Altura das marcas sobre o chão (m), para não disputarem profundidade com a grade. */
const MARK_Y = 0.015
/** Mudança de raio (m) abaixo da qual o anel não é refeito. */
const RADIUS_EPSILON_M = 1e-4
const RING_SEGMENTS = 160

export const RADIUS_INDICATOR_NAMES = {
  root: 'radius-indicator',
  ring: 'radius-ring',
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

function flatRing(inner: number, outer: number, segments = RING_SEGMENTS): RingGeometry {
  const geometry = new RingGeometry(Math.max(0, inner), outer, segments, 1)
  // RingGeometry nasce no plano XY; deitada no chão (XZ), com a face para cima.
  geometry.rotateX(-Math.PI / 2)
  return geometry
}

function groundLine(points: readonly { x: number; z: number }[]): BufferGeometry {
  return new BufferGeometry().setFromPoints(points.map((p) => new Vector3(p.x, MARK_Y, p.z)))
}

/** Linha tracejada no chão: o tracejado precisa das distâncias acumuladas ao longo da linha. */
function dashedGroundLine(
  points: readonly { x: number; z: number }[],
  material: LineDashedMaterial,
): Line<BufferGeometry, LineDashedMaterial> {
  const line = new Line(groundLine(points), material)
  line.computeLineDistances()
  return line
}

export class RadiusIndicator {
  readonly root = new Group()
  /** Onde a camada HTML pendura o rótulo (CSS2D); acompanha o anel. */
  readonly labelAnchor = new Object3D()
  readonly reach: ReachRange

  private readonly ring: Mesh<RingGeometry, MeshBasicMaterial>
  private readonly radial: Line<BufferGeometry, LineDashedMaterial>
  private readonly hookMark: Mesh<RingGeometry, MeshBasicMaterial>
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
        opacity: 1,
        depthWrite: false,
        toneMapped: false,
        fog: false,
      }),
    )
    this.ring.name = RADIUS_INDICATOR_NAMES.ring
    this.ring.position.y = MARK_Y
    this.ring.renderOrder = 2

    // Linha de cota do eixo de giro até o gancho, em tinta: a cor da situação fica só no anel.
    this.radial = dashedGroundLine(
      [
        { x: 0, z: 0 },
        { x: 0, z: 1 },
      ],
      new LineDashedMaterial({
        color: SCENE_COLORS.radial,
        dashSize: RADIAL_DASH_M.dash,
        gapSize: RADIAL_DASH_M.gap,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        toneMapped: false,
      }),
    )
    this.radial.name = RADIUS_INDICATOR_NAMES.radial
    this.radial.renderOrder = 2

    this.hookMark = new Mesh(
      flatRing(HOOK_MARK_RADII_M.inner, HOOK_MARK_RADII_M.outer, 32),
      new MeshBasicMaterial({
        color: color.clone(),
        transparent: true,
        opacity: 1,
        depthWrite: false,
        toneMapped: false,
      }),
    )
    this.hookMark.name = RADIUS_INDICATOR_NAMES.hookMark
    this.hookMark.position.y = MARK_Y * 1.5
    this.hookMark.renderOrder = 3

    this.root.add(this.ring, this.radial, this.hookMark, this.labelAnchor)
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
    }

    const end = pointAtRadius(radius, input.turretRotationDeg)
    const position = this.radial.geometry.getAttribute('position')
    position.setXYZ(1, end.x, MARK_Y, end.z)
    position.needsUpdate = true
    this.radial.geometry.computeBoundingSphere()
    this.radial.computeLineDistances()
    this.hookMark.position.set(end.x, MARK_Y * 1.5, end.z)
    const labelAt = radiusLabelPosition(radius, input.turretRotationDeg)
    this.labelAnchor.position.set(labelAt.x, 0.05, labelAt.z)
    this.setVisible(true)
    return true
  }

  /** Pinta o anel e a marca do gancho com a cor da situação; a linha radial fica em tinta. */
  setStatus(status: EvaluationStatus): void {
    this.status = status
    const color = statusColor(status)
    for (const mesh of [this.ring, this.hookMark]) {
      mesh.material.color.setHex(color)
    }
  }

  private setVisible(visible: boolean): void {
    this.ring.visible = visible
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

  /**
   * Arcos tracejados (linha fantasma) do raio mínimo e máximo, na faixa de giro da torre, fixos para a
   * configuração.
   */
  private addReachArcs(limits: CraneLimits): void {
    const sweep = computeTurretSweep(limits.turretRotationDeg)
    const segments = arcSegments(sweep.startDeg, sweep.endDeg)
    const material = new LineDashedMaterial({
      color: SCENE_COLORS.reachArc,
      dashSize: REACH_DASH_M.dash,
      gapSize: REACH_DASH_M.gap,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
      toneMapped: false,
    })

    const arcs: [string, number][] = [
      [RADIUS_INDICATOR_NAMES.reachMin, this.reach.minM],
      [RADIUS_INDICATOR_NAMES.reachMax, this.reach.maxM],
    ]
    for (const [name, radius] of arcs) {
      if (!(radius > 0)) continue
      const line = dashedGroundLine(
        arcPoints(radius, sweep.startDeg, sweep.endDeg, segments),
        material,
      )
      line.name = name
      this.root.add(line)
    }

    // Com giro limitado, fecha o setor com os dois raios das pontas.
    if (!sweep.full && this.reach.maxM > this.reach.minM) {
      const edges = dashedGroundLine(
        [
          pointAtRadius(this.reach.minM, sweep.startDeg),
          pointAtRadius(this.reach.maxM, sweep.startDeg),
        ],
        material,
      )
      edges.name = RADIUS_INDICATOR_NAMES.reachEdges
      const otherEdge = dashedGroundLine(
        [
          pointAtRadius(this.reach.minM, sweep.endDeg),
          pointAtRadius(this.reach.maxM, sweep.endDeg),
        ],
        material,
      )
      otherEdge.name = RADIUS_INDICATOR_NAMES.reachEdges
      this.root.add(edges, otherEdge)
    }
  }
}
