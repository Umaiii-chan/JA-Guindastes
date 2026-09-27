import {
  BufferGeometry,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  RingGeometry,
  Vector3,
} from 'three'

import { SCENE_COLORS } from './palette'
import { arcPoints, arcSegments, type GroundPoint, pointAtRadius } from './radiusGeometry'

// Setores das zonas de giro no chão, ao redor do eixo de giro (TASK-046; ADR-018), para a conferência
// visual do cadastro: em traço de tinta (TASK-047; ADR-019), com fronteiras finas, preenchimento quase
// transparente, a zona atual no acento laranja, o arco externo e um rótulo curto. Só desenho: a zona que vale na avaliação é a do backend (RN-008; ADR-013 C-7).
//
// Convenção de ψ do ADR-013 C-2: a direção da lança com giro ψ é u(ψ) = (sen ψ, 0, cos ψ); 0° = +Z
// (frente), 90° = +X (esquerda), anti-horário visto de cima. O setor vai de `startDeg` a `endDeg` no
// sentido crescente e pode passar por 0°.

/** Zona como a cena a recebe (o mesmo formato de `RotationZone` do domínio). */
export interface SceneRotationZone {
  readonly code: string
  readonly name: string
  readonly startDeg: number
  readonly endDeg: number
}

/** Raios (m) da faixa dos setores no chão. */
export interface ZoneSectorRadii {
  readonly innerM: number
  readonly outerM: number
}

/** Âncora do rótulo de uma zona (a camada HTML pendura o texto nela). */
export interface ZoneLabelAnchor {
  readonly code: string
  readonly name: string
  readonly anchor: Object3D
}

export const ROTATION_ZONE_NAMES = {
  root: 'rotation-zone-sectors',
  fill: 'rotation-zone-fill',
  arc: 'rotation-zone-arc',
  boundary: 'rotation-zone-boundary',
  labelAnchor: 'rotation-zone-label-anchor',
} as const

/**
 * Opacidade da fatia: quase transparente, só um véu de tinta na zona atual (ADR-019). O que marca a
 * zona é o traço do arco, não o preenchimento.
 */
export const ZONE_FILL_OPACITY = { idle: 0.02, active: 0.05 } as const
const ZONE_ARC_OPACITY = { idle: 0.55, active: 1 } as const
const ZONE_BOUNDARY_OPACITY = 0.5

/** Um pouco abaixo do anel de raio (0,015 m), para não disputar profundidade com ele. */
const SECTOR_Y = 0.008
const DEG = Math.PI / 180

function normalizeDeg(value: number): number {
  return ((value % 360) + 360) % 360
}

/** Abertura do setor (°), no sentido crescente de ψ; 0 quando início = fim. */
export function sectorSpanDeg(zone: Pick<SceneRotationZone, 'startDeg' | 'endDeg'>): number {
  return normalizeDeg(zone.endDeg - zone.startDeg)
}

/**
 * Ângulos da `RingGeometry` (plano XY, deitada com `rotateX(−90°)`) para o setor. Deitada, o ponto
 * de ângulo t vai para (cos t, 0, −sen t); igualando a u(ψ) = (sen ψ, 0, cos ψ), t = ψ − 90°, e t
 * cresce com ψ.
 */
export function sectorTheta(zone: Pick<SceneRotationZone, 'startDeg' | 'endDeg'>): {
  readonly thetaStart: number
  readonly thetaLength: number
} {
  return { thetaStart: (zone.startDeg - 90) * DEG, thetaLength: sectorSpanDeg(zone) * DEG }
}

/** Ponto do rótulo: no meio do setor, perto da borda externa. */
export function zoneLabelPosition(zone: SceneRotationZone, radii: ZoneSectorRadii): GroundPoint {
  const middle = zone.startDeg + sectorSpanDeg(zone) / 2
  const radius = radii.innerM + (radii.outerM - radii.innerM) * 0.78
  return pointAtRadius(radius, middle)
}

function groundLine(points: readonly GroundPoint[]): BufferGeometry {
  return new BufferGeometry().setFromPoints(points.map((p) => new Vector3(p.x, SECTOR_Y, p.z)))
}

interface SectorParts {
  readonly zone: SceneRotationZone
  readonly fill: Mesh<RingGeometry, MeshBasicMaterial>
  readonly arc: Line<BufferGeometry, LineBasicMaterial>
}

export class RotationZoneSectors {
  readonly root = new Group()
  private readonly radii: ZoneSectorRadii
  private sectors: SectorParts[] = []
  private anchors: ZoneLabelAnchor[] = []
  private readonly boundaryMaterial = new LineBasicMaterial({
    color: SCENE_COLORS.zoneBoundary,
    transparent: true,
    opacity: ZONE_BOUNDARY_OPACITY,
    depthWrite: false,
    toneMapped: false,
  })
  private key = ''
  private active: string | null = null

  constructor(radii: ZoneSectorRadii) {
    this.root.name = ROTATION_ZONE_NAMES.root
    const innerM = Math.max(0, radii.innerM)
    this.radii = { innerM, outerM: Math.max(innerM + 0.5, radii.outerM) }
    this.root.visible = false
  }

  /** Zonas desenhadas agora (vazia = nenhuma). */
  get zones(): readonly SceneRotationZone[] {
    return this.sectors.map((sector) => sector.zone)
  }

  get activeCode(): string | null {
    return this.active
  }

  /** Âncoras dos rótulos, na ordem das zonas; mudam a cada `setZones`. */
  get labelAnchors(): readonly ZoneLabelAnchor[] {
    return this.anchors
  }

  /**
   * Troca os setores. Devolve `true` se mudou algo (quem mantém os rótulos HTML os refaz só nesse
   * caso). Zona de abertura 0 não é desenhada.
   */
  setZones(zones: readonly SceneRotationZone[]): boolean {
    const key = JSON.stringify(
      zones.map((zone) => [zone.code, zone.name, zone.startDeg, zone.endDeg]),
    )
    if (key === this.key) return false
    this.key = key
    this.clear()

    for (const zone of zones) {
      const span = sectorSpanDeg(zone)
      if (span === 0) continue
      const { thetaStart, thetaLength } = sectorTheta(zone)
      const geometry = new RingGeometry(
        this.radii.innerM,
        this.radii.outerM,
        Math.max(8, Math.ceil(span / 3)),
        1,
        thetaStart,
        thetaLength,
      )
      geometry.rotateX(-Math.PI / 2)
      const fill = new Mesh(
        geometry,
        new MeshBasicMaterial({
          color: SCENE_COLORS.zoneSector,
          transparent: true,
          opacity: ZONE_FILL_OPACITY.idle,
          depthWrite: false,
          toneMapped: false,
          fog: false,
        }),
      )
      fill.name = ROTATION_ZONE_NAMES.fill
      fill.position.y = SECTOR_Y
      fill.renderOrder = 0
      fill.userData.zoneCode = zone.code

      const end = zone.startDeg + span
      const arc = new Line(
        groundLine(
          arcPoints(this.radii.outerM, zone.startDeg, end, arcSegments(zone.startDeg, end)),
        ),
        new LineBasicMaterial({
          color: SCENE_COLORS.zoneSector,
          transparent: true,
          opacity: ZONE_ARC_OPACITY.idle,
          depthWrite: false,
          toneMapped: false,
        }),
      )
      arc.name = ROTATION_ZONE_NAMES.arc
      arc.userData.zoneCode = zone.code

      // Fronteira no início de cada setor (o fim é o início do vizinho, quando as zonas cobrem 360°).
      const boundary = new Line(
        groundLine([
          pointAtRadius(this.radii.innerM, zone.startDeg),
          pointAtRadius(this.radii.outerM, zone.startDeg),
        ]),
        this.boundaryMaterial,
      )
      boundary.name = ROTATION_ZONE_NAMES.boundary

      const anchor = new Object3D()
      anchor.name = ROTATION_ZONE_NAMES.labelAnchor
      const at = zoneLabelPosition(zone, this.radii)
      anchor.position.set(at.x, 0.05, at.z)
      anchor.userData.zoneCode = zone.code

      this.root.add(fill, arc, boundary, anchor)
      this.sectors.push({ zone, fill, arc })
      this.anchors.push({ code: zone.code, name: zone.name, anchor })
    }
    this.root.visible = this.sectors.length > 0
    this.paint()
    return true
  }

  /** Destaca a zona atual (`null` = nenhuma). Devolve `true` se mudou. */
  setActive(code: string | null): boolean {
    if (code === this.active) return false
    this.active = code
    this.paint()
    return true
  }

  /** Libera geometrias e materiais. Pode ser chamado mais de uma vez. */
  dispose(): void {
    this.clear()
    this.boundaryMaterial.dispose()
  }

  private paint(): void {
    for (const { zone, fill, arc } of this.sectors) {
      const active = zone.code === this.active
      fill.material.opacity = active ? ZONE_FILL_OPACITY.active : ZONE_FILL_OPACITY.idle
      fill.material.color.setHex(active ? SCENE_COLORS.zoneSectorActive : SCENE_COLORS.zoneSector)
      arc.material.opacity = active ? ZONE_ARC_OPACITY.active : ZONE_ARC_OPACITY.idle
      arc.material.color.setHex(active ? SCENE_COLORS.zoneSectorActive : SCENE_COLORS.zoneSector)
    }
  }

  private clear(): void {
    for (const child of [...this.root.children]) {
      child.removeFromParent()
      if (child instanceof Mesh || child instanceof Line) {
        child.geometry.dispose()
        if (child.material !== this.boundaryMaterial)
          (child.material as MeshBasicMaterial).dispose()
      }
    }
    this.sectors = []
    this.anchors = []
    this.root.visible = false
  }
}
