import {
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
} from 'three'

import type { DeliveryPoint } from '../../domain/environment/environment'
import { disposeObject3D } from './disposeObject3D'
import { PAPER_INK, STATUS_COLORS } from './palette'

export const DELIVERY_MARKER_NAMES = Object.freeze({
  root: 'delivery-marker',
})

const SEGMENTS = 64
/** Espessura do anel (m), limitada a uma fração do raio. */
const RING_WIDTH_M = 0.3
/** Sobe um pouco do terreno para não brigar com ele no desenho. */
const LIFT_M = 0.05

/**
 * Ponto de entrega (TASK-073; ADR-035): alvo no chão, um anel com o raio de tolerância, um disco leve
 * por dentro e uma cruz no centro, acompanhando o relevo. Laranja enquanto espera a carga e verde
 * depois da entrega. Só desenho.
 */
export class DeliveryMarker {
  readonly root = new Group()

  private readonly fillMaterial = new MeshBasicMaterial({
    color: PAPER_INK.accent,
    transparent: true,
    opacity: 0.14,
    side: DoubleSide,
    depthWrite: false,
  })
  private readonly ringMaterial = new MeshBasicMaterial({
    color: PAPER_INK.accent,
    transparent: true,
    opacity: 0.9,
    side: DoubleSide,
    depthWrite: false,
  })
  private readonly crossMaterial = new LineBasicMaterial({ color: PAPER_INK.accent })
  private parts: (Mesh | LineSegments)[] = []

  constructor() {
    this.root.name = DELIVERY_MARKER_NAMES.root
    this.root.visible = false
  }

  /** Desenha o alvo (`null` apaga). `heightAt` dá a altura do terreno. */
  setDelivery(
    delivery: DeliveryPoint | null,
    heightAt: (x: number, z: number) => number,
    delivered = false,
  ): void {
    this.clear()
    if (!delivery || !(delivery.radiusM > 0)) {
      this.root.visible = false
      return
    }
    const color = delivered ? STATUS_COLORS.ok : PAPER_INK.accent
    this.ringMaterial.color.setHex(color)
    this.fillMaterial.color.setHex(color)
    this.crossMaterial.color.setHex(color)
    const { x: cx, z: cz, radiusM } = delivery
    const ringWidth = Math.min(RING_WIDTH_M, radiusM / 3)
    const at = (radius: number, index: number): number[] => {
      const angle = (index / SEGMENTS) * Math.PI * 2
      const x = cx + Math.cos(angle) * radius
      const z = cz + Math.sin(angle) * radius
      return [x, heightAt(x, z) + LIFT_M, z]
    }
    // Anel: faixa entre `radiusM - ringWidth` e `radiusM`.
    const ring: number[] = []
    const ringIndex: number[] = []
    for (let i = 0; i < SEGMENTS; i += 1) {
      ring.push(...at(radiusM - ringWidth, i), ...at(radiusM, i))
      const a = i * 2
      const b = ((i + 1) % SEGMENTS) * 2
      ringIndex.push(a, a + 1, b, a + 1, b + 1, b)
    }
    // Disco: leque do centro até a borda interna, com um anel intermediário para seguir o relevo.
    const fill: number[] = [cx, heightAt(cx, cz) + LIFT_M, cz]
    const fillIndex: number[] = []
    for (const fraction of [0.5, 1]) {
      for (let i = 0; i < SEGMENTS; i += 1) fill.push(...at((radiusM - ringWidth) * fraction, i))
    }
    for (let i = 0; i < SEGMENTS; i += 1) {
      const next = (i + 1) % SEGMENTS
      fillIndex.push(0, 1 + i, 1 + next)
      fillIndex.push(1 + i, 1 + SEGMENTS + i, 1 + next)
      fillIndex.push(1 + next, 1 + SEGMENTS + i, 1 + SEGMENTS + next)
    }
    const build = (positions: number[], index: number[]): BufferGeometry => {
      const geometry = new BufferGeometry()
      geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
      geometry.setIndex(index)
      return geometry
    }
    const fillMesh = new Mesh(build(fill, fillIndex), this.fillMaterial)
    const ringMesh = new Mesh(build(ring, ringIndex), this.ringMaterial)
    fillMesh.renderOrder = 2
    ringMesh.renderOrder = 3
    // Cruz no centro, alinhada ao giro do alvo.
    const arm = Math.min(radiusM / 3, 0.8)
    const rotation = (delivery.rotationYDeg * Math.PI) / 180
    const point = (u: number, v: number): number[] => {
      const x = cx + u * Math.cos(rotation) + v * Math.sin(rotation)
      const z = cz - u * Math.sin(rotation) + v * Math.cos(rotation)
      return [x, heightAt(x, z) + LIFT_M * 1.5, z]
    }
    const crossGeometry = new BufferGeometry()
    crossGeometry.setAttribute(
      'position',
      new Float32BufferAttribute(
        [...point(-arm, 0), ...point(arm, 0), ...point(0, -arm), ...point(0, arm)],
        3,
      ),
    )
    const cross = new LineSegments(crossGeometry, this.crossMaterial)
    cross.renderOrder = 3
    this.parts = [fillMesh, ringMesh, cross]
    this.root.add(...this.parts)
    this.root.visible = true
  }

  private clear(): void {
    for (const part of this.parts) {
      part.removeFromParent()
      part.geometry.dispose()
    }
    this.parts = []
  }

  dispose(): void {
    this.clear()
    this.fillMaterial.dispose()
    this.ringMaterial.dispose()
    this.crossMaterial.dispose()
    this.root.removeFromParent()
    disposeObject3D(this.root)
  }
}
