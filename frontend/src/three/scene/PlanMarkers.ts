import { CircleGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial, RingGeometry } from 'three'

import type { CargoPlacement, DeliveryPlacement } from '../../domain/environment/environment'
import { disposeObject3D } from './disposeObject3D'

export const PLAN_MARKER_NAMES = Object.freeze({
  root: 'plan-markers',
  pick: 'plan-marker-pick',
  delivery: 'plan-marker-delivery',
})

/** Cores FICTÍCIAS de tela: coleta em laranja, entrega em verde. */
export const PLAN_MARKER_COLORS = Object.freeze({ pick: 0xd9822b, delivery: 0x3f9b6b })

const SEGMENTS = 48
const LIFT_M = 0.06
/** Raio do marcador da coleta, que não tem raio próprio no cenário. */
const PICK_RADIUS_M = 1

/**
 * Marcadores no chão da coleta e da entrega da carga (TASK-073; TASK-075): um anel com um ponto no
 * centro, acompanhando o relevo. Só desenho.
 */
export class PlanMarkers {
  readonly root = new Group()

  constructor() {
    this.root.name = PLAN_MARKER_NAMES.root
  }

  setPoints(
    cargo: CargoPlacement | undefined,
    delivery: DeliveryPlacement | undefined,
    heightAt: (x: number, z: number) => number,
  ): void {
    this.clear()
    if (cargo) {
      this.add(
        PLAN_MARKER_NAMES.pick,
        PLAN_MARKER_COLORS.pick,
        cargo.x,
        cargo.z,
        PICK_RADIUS_M,
        heightAt,
      )
    }
    if (delivery) {
      this.add(
        PLAN_MARKER_NAMES.delivery,
        PLAN_MARKER_COLORS.delivery,
        delivery.x,
        delivery.z,
        Math.max(0.5, delivery.radiusM),
        heightAt,
      )
    }
  }

  get count(): number {
    return this.root.children.length
  }

  private add(
    name: string,
    color: number,
    x: number,
    z: number,
    radiusM: number,
    heightAt: (x: number, z: number) => number,
  ): void {
    const group = new Group()
    group.name = name
    group.position.set(x, heightAt(x, z) + LIFT_M, z)
    const material = () =>
      new MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.85,
        side: DoubleSide,
        depthWrite: false,
      })
    const ring = new Mesh(new RingGeometry(radiusM - 0.12, radiusM, SEGMENTS), material())
    ring.rotation.x = -Math.PI / 2
    const dot = new Mesh(new CircleGeometry(0.22, 24), material())
    dot.rotation.x = -Math.PI / 2
    group.add(ring, dot)
    group.renderOrder = 3
    this.root.add(group)
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
