import { DoubleSide, Group, Mesh, MeshBasicMaterial, RingGeometry } from 'three'

import type { SoilZone } from '../../domain/environment/environment'
import { disposeObject3D } from './disposeObject3D'
import { SOIL_COLORS } from './palette'

export const SOIL_OVERLAY_NAMES = Object.freeze({ root: 'scenario-soil-zones' })

const SEGMENTS = 48
const RINGS = 8
/** Afastamento (m) acima do terreno, para não brigar com a malha (z-fighting). */
const LIFT_M = 0.04
const OPACITY = 0.45

/**
 * Zonas de solo pintadas (TASK-066; ADR-032): discos semitransparentes que acompanham o relevo,
 * um por zona, na ordem da lista (a mais recente por cima, como em `soilAt`). Só desenho.
 */
export class SoilOverlay {
  readonly root = new Group()

  constructor() {
    this.root.name = SOIL_OVERLAY_NAMES.root
  }

  setZones(zones: readonly SoilZone[], heightAt: (x: number, z: number) => number): void {
    this.clear()
    zones.forEach((zone, order) => {
      if (!(zone.radiusM > 0)) return
      const geometry = new RingGeometry(0.0001, zone.radiusM, SEGMENTS, RINGS)
      geometry.rotateX(-Math.PI / 2)
      const position = geometry.getAttribute('position')
      for (let i = 0; i < position.count; i += 1) {
        const x = position.getX(i) + zone.centerX
        const z = position.getZ(i) + zone.centerZ
        position.setXYZ(i, x, heightAt(x, z) + LIFT_M + order * 0.002, z)
      }
      position.needsUpdate = true
      const mesh = new Mesh(
        geometry,
        new MeshBasicMaterial({
          color: SOIL_COLORS[zone.kind],
          transparent: true,
          opacity: OPACITY,
          depthWrite: false,
          side: DoubleSide,
          polygonOffset: true,
          polygonOffsetFactor: -2,
          polygonOffsetUnits: -2,
        }),
      )
      mesh.name = `scenario-soil-${zone.id}`
      mesh.renderOrder = 1 + order
      this.root.add(mesh)
    })
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
