import {
  BoxGeometry,
  CylinderGeometry,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  Vector3,
} from 'three'

import {
  type PowerLine,
  powerLineLengthM,
  requiredClearanceM,
} from '../../domain/environment/powerLine'
import { disposeObject3D } from './disposeObject3D'
import { POWER_LINE_COLORS } from './palette'

export const POWER_LINE_NAMES = Object.freeze({ root: 'scenario-power-lines' })

const CABLE_RADIUS_M = 0.05
const POLE_RADIUS_M = 0.15

/**
 * Redes elétricas do cenário (TASK-107; ADR-051): o cabo (cilindro fino) entre dois postes, e em volta
 * dele o contorno da zona de distância mínima da tensão, que é o que o planejador evita (a caixa do
 * trecho crescida da distância mínima em todas as direções). Só desenho; quem mede a distância é o
 * backend (RN-008).
 */
export class PowerLineMeshes {
  readonly root = new Group()

  constructor() {
    this.root.name = POWER_LINE_NAMES.root
  }

  setLines(lines: readonly PowerLine[], heightAt: (x: number, z: number) => number): void {
    this.clear()
    for (const line of lines) {
      const length = powerLineLengthM(line)
      if (!(length > 0)) continue
      const group = new Group()
      group.name = `power-line-${line.id}`
      group.userData = { powerLineId: line.id, voltageKv: line.voltageKv }

      const centerX = (line.x1M + line.x2M) / 2
      const centerZ = (line.z1M + line.z2M) / 2
      // Direção do trecho no plano; o eixo X local do cilindro/caixa é girado até ela.
      const yaw = Math.atan2(-(line.z2M - line.z1M), line.x2M - line.x1M)

      const cable = new Mesh(
        new CylinderGeometry(CABLE_RADIUS_M, CABLE_RADIUS_M, length, 8),
        new MeshBasicMaterial({ color: POWER_LINE_COLORS.cable }),
      )
      cable.rotation.set(0, yaw, Math.PI / 2, 'YZX')
      cable.position.set(centerX, line.heightM, centerZ)
      cable.name = 'power-line-cable'
      group.add(cable)

      for (const [x, z] of [
        [line.x1M, line.z1M],
        [line.x2M, line.z2M],
      ] as const) {
        const ground = heightAt(x, z)
        const height = Math.max(0.1, line.heightM - ground)
        const pole = new Mesh(
          new CylinderGeometry(POLE_RADIUS_M, POLE_RADIUS_M, height, 8),
          new MeshBasicMaterial({ color: POWER_LINE_COLORS.pole }),
        )
        pole.position.set(x, ground + height / 2, z)
        pole.name = 'power-line-pole'
        group.add(pole)
      }

      const clearance = requiredClearanceM(line.voltageKv)
      if (clearance !== null) {
        const zone = new BoxGeometry(length + 2 * clearance, 2 * clearance, 2 * clearance)
        const outline = new LineSegments(
          new EdgesGeometry(zone),
          new LineBasicMaterial({
            color: POWER_LINE_COLORS.zone,
            transparent: true,
            opacity: 0.55,
          }),
        )
        zone.dispose()
        outline.rotation.y = yaw
        outline.position.copy(new Vector3(centerX, line.heightM, centerZ))
        outline.name = 'power-line-zone'
        group.add(outline)
      }
      this.root.add(group)
    }
  }

  private clear(): void {
    for (const child of [...this.root.children]) {
      disposeObject3D(child)
      this.root.remove(child)
    }
  }

  dispose(): void {
    this.clear()
    this.root.removeFromParent()
  }
}
