import {
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
} from 'three'

import type { OperatingArea, OperatingAreaLevel } from '../../domain/evaluation/operatingArea'
import { STATUS_COLORS } from './palette'
import { pointAtRadius } from './radiusGeometry'

// Área de operação no chão (TASK-055; ADR-025): células polares (giro ψ × raio R) pintadas de verde,
// amarelo e vermelho, no estilo dos setores das zonas de giro (RotationZoneSectors): véu translúcido
// sobre o papel, ao redor do eixo de giro. Só desenho: o nível de cada célula vem do backend
// (RN-008). Uma malha só, com cor por vértice, para centenas de células não pesarem.
//
// Convenção de ψ do ADR-013 C-2: a direção da lança com giro ψ é u(ψ) = (sen ψ, 0, cos ψ). Cada
// célula cobre o passo da grade centrado no seu ψ e no seu R.

export const OPERATING_AREA_NAMES = {
  root: 'operating-area-overlay',
  cells: 'operating-area-cells',
}

/** Cor de cada nível: as mesmas cores de situação do ADR-019 (verde, âmbar, vermelho). */
export const OPERATING_AREA_COLORS: Readonly<Record<OperatingAreaLevel, number>> = Object.freeze({
  GREEN: STATUS_COLORS.ok,
  YELLOW: STATUS_COLORS.warning,
  RED: STATUS_COLORS.over,
})

export const OPERATING_AREA_OPACITY = 0.42

/** Acima do chão e abaixo dos setores das zonas (0,008 m), para não disputar profundidade. */
const AREA_Y = 0.004
const MAX_ARC_STEP_DEG = 5

export interface OperatingAreaMeshData {
  /** x, y, z de cada vértice, em sequência (triângulos soltos). */
  readonly positions: Float32Array
  /** r, g, b (sRGB 0..1) de cada vértice. */
  readonly colors: Float32Array
  readonly triangleCount: number
}

/** Triângulos e cores das células, sem Three.js pesado (testável). */
export function buildOperatingAreaMeshData(area: OperatingArea): OperatingAreaMeshData {
  const positions: number[] = []
  const colors: number[] = []
  const color = new Color()
  const halfPsi = area.psiStepDeg / 2
  const halfRadius = area.radiusStepM / 2
  const segments = Math.max(1, Math.ceil(area.psiStepDeg / MAX_ARC_STEP_DEG))

  const push = (radiusM: number, psiDeg: number, rgb: readonly [number, number, number]) => {
    const point = pointAtRadius(radiusM, psiDeg)
    positions.push(point.x, AREA_Y, point.z)
    colors.push(...rgb)
  }

  for (const cell of area.cells) {
    color.setHex(OPERATING_AREA_COLORS[cell.level])
    const rgb: readonly [number, number, number] = [color.r, color.g, color.b]
    const inner = Math.max(0, cell.radiusM - halfRadius)
    const outer = cell.radiusM + halfRadius
    for (let index = 0; index < segments; index += 1) {
      const from = cell.psiDeg - halfPsi + (area.psiStepDeg * index) / segments
      const to = cell.psiDeg - halfPsi + (area.psiStepDeg * (index + 1)) / segments
      // Dois triângulos por fatia da célula. Sentido anti-horário visto de cima; a malha é de duas
      // faces, então o sentido não importa para aparecer.
      push(inner, from, rgb)
      push(outer, from, rgb)
      push(outer, to, rgb)
      push(inner, from, rgb)
      push(outer, to, rgb)
      push(inner, to, rgb)
    }
  }
  return {
    positions: new Float32Array(positions),
    colors: new Float32Array(colors),
    triangleCount: positions.length / 9,
  }
}

export class OperatingAreaOverlay {
  readonly root = new Group()
  private mesh: Mesh<BufferGeometry, MeshBasicMaterial> | null = null
  private current: OperatingArea | null = null
  private readonly material = new MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: OPERATING_AREA_OPACITY,
    depthWrite: false,
    toneMapped: false,
    fog: false,
    side: DoubleSide,
  })

  constructor() {
    this.root.name = OPERATING_AREA_NAMES.root
    this.root.visible = false
  }

  /** Área desenhada agora, ou `null`. */
  get area(): OperatingArea | null {
    return this.current
  }

  /** Quantidade de células desenhadas. */
  get cellCount(): number {
    return this.current?.cells.length ?? 0
  }

  /** Troca a área (`null` apaga). Devolve `true` se mudou algo. */
  setArea(area: OperatingArea | null): boolean {
    if (area === this.current) return false
    this.clear()
    this.current = area
    if (area === null || area.cells.length === 0) return true

    const data = buildOperatingAreaMeshData(area)
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(data.positions, 3))
    geometry.setAttribute('color', new Float32BufferAttribute(data.colors, 3))
    const mesh = new Mesh(geometry, this.material)
    mesh.name = OPERATING_AREA_NAMES.cells
    mesh.renderOrder = -1
    mesh.frustumCulled = false
    this.root.add(mesh)
    this.mesh = mesh
    this.root.visible = true
    return true
  }

  /** Libera geometria e material. Pode ser chamado mais de uma vez. */
  dispose(): void {
    this.clear()
    this.material.dispose()
  }

  private clear(): void {
    if (this.mesh) {
      this.mesh.removeFromParent()
      this.mesh.geometry.dispose()
      this.mesh = null
    }
    this.current = null
    this.root.visible = false
  }
}
