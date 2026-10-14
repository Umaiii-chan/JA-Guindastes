// Setores das zonas de giro no chão (TASK-046), com zonas FICTÍCIAS. Convenção de ψ do ADR-013 C-2:
// 0° = +Z (frente), 90° = +X (esquerda), anti-horário visto de cima.

import {
  Box3,
  type Line,
  type LineBasicMaterial,
  type Mesh,
  type MeshBasicMaterial,
  Vector3,
} from 'three'
import { describe, expect, it } from 'vitest'

import { buildCraneScene } from '../../../src/three/scene/buildCraneScene'
import { SCENE_COLORS } from '../../../src/three/scene/palette'
import {
  ROTATION_ZONE_NAMES,
  RotationZoneSectors,
  sectorSpanDeg,
  sectorTheta,
  ZONE_FILL_OPACITY,
  zoneLabelPosition,
} from '../../../src/three/scene/RotationZoneSectors'

const ZONES = [
  { code: 'FRONTAL', name: 'Frontal FICTÍCIA', startDeg: 305, endDeg: 55 },
  { code: 'LATERAL_TRASEIRA', name: 'Lateral e traseira FICTÍCIA', startDeg: 55, endDeg: 305 },
]
const RADII = { innerM: 1.5, outerM: 20 }

function fills(sectors: RotationZoneSectors): Mesh[] {
  return sectors.root.children.filter((child) => child.name === ROTATION_ZONE_NAMES.fill) as Mesh[]
}

describe('RotationZoneSectors', () => {
  it('abertura e ângulos da RingGeometry seguem ψ (passando por 0°)', () => {
    expect(sectorSpanDeg(ZONES[0])).toBe(110)
    expect(sectorSpanDeg(ZONES[1])).toBe(250)
    const theta = sectorTheta(ZONES[0])
    expect(theta.thetaStart).toBeCloseTo(((305 - 90) * Math.PI) / 180)
    expect(theta.thetaLength).toBeCloseTo((110 * Math.PI) / 180)
  })

  it('o setor frontal fica em volta de +Z e o lateral/traseiro cobre −Z', () => {
    const sectors = new RotationZoneSectors(RADII)
    expect(sectors.setZones(ZONES)).toBe(true)
    const [front, rear] = fills(sectors)
    const frontBox = new Box3().setFromObject(front)
    const rearBox = new Box3().setFromObject(rear)
    // Frontal: 305° → 55° em volta de ψ = 0 (+Z); só z > 0 e simétrico em x.
    expect(frontBox.min.z).toBeGreaterThan(0.5)
    expect(frontBox.max.z).toBeCloseTo(20, 1)
    expect(frontBox.max.x).toBeCloseTo(-frontBox.min.x, 3)
    // Lateral e traseira: chega a −Z (ψ = 180°) e aos dois lados.
    expect(rearBox.min.z).toBeCloseTo(-20, 1)
    expect(rearBox.max.x).toBeCloseTo(20, 1)
    expect(rearBox.min.x).toBeCloseTo(-20, 1)
    // Rótulo no meio do setor: frontal em +Z, lateral/traseira em −Z.
    expect(zoneLabelPosition(ZONES[0], RADII).z).toBeGreaterThan(10)
    expect(Math.abs(zoneLabelPosition(ZONES[0], RADII).x)).toBeLessThan(1e-9)
    expect(zoneLabelPosition(ZONES[1], RADII).z).toBeLessThan(-10)
  })

  it('um setor a 90° (esquerda) fica em +X', () => {
    const sectors = new RotationZoneSectors(RADII)
    sectors.setZones([
      { code: 'ESQ', name: 'Esquerda', startDeg: 60, endDeg: 120 },
      { code: 'RESTO', name: 'Resto', startDeg: 120, endDeg: 60 },
    ])
    const box = new Box3().setFromObject(fills(sectors)[0])
    const center = box.getCenter(new Vector3())
    expect(center.x).toBeGreaterThan(5)
    expect(Math.abs(center.z)).toBeLessThan(1)
  })

  it('destaca a zona atual; sem zonas, fica oculto; mesmas zonas não refazem nada', () => {
    const sectors = new RotationZoneSectors(RADII)
    expect(sectors.root.visible).toBe(false)
    sectors.setZones(ZONES)
    expect(sectors.root.visible).toBe(true)
    expect(sectors.labelAnchors.map((item) => item.code)).toEqual(['FRONTAL', 'LATERAL_TRASEIRA'])

    expect(sectors.setActive('LATERAL_TRASEIRA')).toBe(true)
    expect(sectors.setActive('LATERAL_TRASEIRA')).toBe(false)
    const [front, rear] = fills(sectors)
    const opacity = (mesh: Mesh) => (mesh.material as MeshBasicMaterial).opacity
    const color = (mesh: Mesh) => (mesh.material as MeshBasicMaterial).color.getHex()
    expect(opacity(rear)).toBe(ZONE_FILL_OPACITY.active)
    expect(opacity(front)).toBe(ZONE_FILL_OPACITY.idle)
    expect(color(rear)).toBe(SCENE_COLORS.zoneSectorActive)
    expect(color(front)).toBe(SCENE_COLORS.zoneSector)
    // Traço de tinta: o preenchimento é quase transparente, mesmo na zona atual (ADR-019).
    expect(ZONE_FILL_OPACITY.active).toBeLessThanOrEqual(0.08)
    expect(ZONE_FILL_OPACITY.idle).toBeLessThan(ZONE_FILL_OPACITY.active)
    const arcColor = (code: string) =>
      (
        sectors.root.children.find(
          (child) => child.name === ROTATION_ZONE_NAMES.arc && child.userData.zoneCode === code,
        ) as Line
      ).material as LineBasicMaterial
    expect(arcColor('LATERAL_TRASEIRA').color.getHex()).toBe(SCENE_COLORS.zoneSectorActive)
    expect(arcColor('FRONTAL').color.getHex()).toBe(SCENE_COLORS.zoneSector)

    expect(sectors.setZones(ZONES.map((zone) => ({ ...zone })))).toBe(false)
    expect(sectors.setZones([])).toBe(true)
    expect(sectors.root.visible).toBe(false)
    expect(sectors.root.children).toHaveLength(0)
    sectors.dispose()
  })

  it('a cena montada tem os setores, vazios até a UI mandar as zonas', () => {
    const contents = buildCraneScene()
    const root = contents.scene.getObjectByName(ROTATION_ZONE_NAMES.root)
    expect(root).toBe(contents.rotationZones.root)
    expect(root?.visible).toBe(false)
    contents.rotationZones.setZones(ZONES)
    expect(contents.scene.getObjectsByProperty('name', ROTATION_ZONE_NAMES.fill)).toHaveLength(2)
  })
})
