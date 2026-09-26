import { Color, Line, Mesh, type MeshBasicMaterial, RingGeometry, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import {
  PROVISIONAL_CRANE_GEOMETRY,
  PROVISIONAL_CRANE_LIMITS,
} from '../../../src/three/crane/provisionalCraneSpec'
import { STATUS_COLORS } from '../../../src/three/scene/palette'
import {
  RADIUS_INDICATOR_NAMES,
  RadiusIndicator,
  RING_WIDTH_M,
} from '../../../src/three/scene/RadiusIndicator'
import { RADIUS_LABEL_OFFSET_M } from '../../../src/three/scene/radiusGeometry'
import { expectClose } from '../../helpers/expectClose'

function indicator(limits = PROVISIONAL_CRANE_LIMITS): RadiusIndicator {
  return new RadiusIndicator(limits, PROVISIONAL_CRANE_GEOMETRY)
}

function ring(target: RadiusIndicator): Mesh<RingGeometry, MeshBasicMaterial> {
  return target.root.getObjectByName(RADIUS_INDICATOR_NAMES.ring) as Mesh<
    RingGeometry,
    MeshBasicMaterial
  >
}

describe('RadiusIndicator', () => {
  it('começa oculto e aparece no raio de trabalho, centrado no eixo de giro, no chão', () => {
    const target = indicator()
    expect(ring(target).visible).toBe(false)

    expect(target.update({ workingRadiusM: 8, turretRotationDeg: 0 })).toBe(true)

    const mesh = ring(target)
    expect(mesh.visible).toBe(true)
    expect(mesh.geometry).toBeInstanceOf(RingGeometry)
    expect(mesh.geometry.parameters.innerRadius).toBeCloseTo(8 - RING_WIDTH_M / 2)
    expect(mesh.geometry.parameters.outerRadius).toBeCloseTo(8 + RING_WIDTH_M / 2)
    mesh.geometry.computeBoundingBox()
    const box = mesh.geometry.boundingBox!
    const center = box.getCenter(new Vector3())
    expectClose(center.x, 0, 1e-9)
    expectClose(center.z, 0, 1e-9)
    // Deitado no chão: sem altura.
    expectClose(box.max.y - box.min.y, 0, 1e-9)
    expect(target.currentRadiusM).toBe(8)
    expect(target.labelText).toBe('R 8,00 m')
  })

  it('não refaz nada quando raio e giro não mudam', () => {
    const target = indicator()
    target.update({ workingRadiusM: 8, turretRotationDeg: 10 })
    const geometry = ring(target).geometry

    expect(target.update({ workingRadiusM: 8, turretRotationDeg: 10 })).toBe(false)
    expect(ring(target).geometry).toBe(geometry)
  })

  it('só gira a linha radial e o rótulo quando muda só o giro', () => {
    const target = indicator()
    target.update({ workingRadiusM: 10, turretRotationDeg: 0 })
    const geometry = ring(target).geometry

    expect(target.update({ workingRadiusM: 10, turretRotationDeg: 90 })).toBe(true)

    expect(ring(target).geometry).toBe(geometry)
    expectClose(target.labelAnchor.position.x, 10 + RADIUS_LABEL_OFFSET_M, 1e-9)
    expectClose(target.labelAnchor.position.z, 0, 1e-9)
    const mark = target.root.getObjectByName(RADIUS_INDICATOR_NAMES.hookMark)!
    expectClose(mark.position.x, 10, 1e-9)
  })

  it('libera a geometria antiga ao mudar o raio', () => {
    const target = indicator()
    target.update({ workingRadiusM: 8, turretRotationDeg: 0 })
    const old = ring(target).geometry
    let disposed = false
    old.addEventListener('dispose', () => {
      disposed = true
    })

    target.update({ workingRadiusM: 9, turretRotationDeg: 0 })

    expect(disposed).toBe(true)
    expect(ring(target).geometry.parameters.outerRadius).toBeCloseTo(9 + RING_WIDTH_M / 2)
  })

  it('some quando o raio não existe (R < 0, ADR-013 C-5)', () => {
    const target = indicator()
    target.update({ workingRadiusM: 8, turretRotationDeg: 0 })

    target.update({ workingRadiusM: null, turretRotationDeg: 0 })

    expect(ring(target).visible).toBe(false)
    expect(target.labelAnchor.visible).toBe(false)
    expect(target.currentRadiusM).toBeNull()
    expect(target.labelText).toBe('')
  })

  it('pinta o anel com a cor da situação (cinza por padrão)', () => {
    const target = indicator()
    const colorOf = (status: keyof typeof STATUS_COLORS) => new Color(STATUS_COLORS[status])

    expect(ring(target).material.color.equals(colorOf('unknown'))).toBe(true)
    target.setStatus('over')
    expect(ring(target).material.color.equals(colorOf('over'))).toBe(true)
    expect(target.currentStatus).toBe('over')
    target.setStatus('ok')
    expect(ring(target).material.color.equals(colorOf('ok'))).toBe(true)
  })

  it('desenha os arcos de alcance mínimo e máximo; com giro limitado, fecha o setor', () => {
    const full = indicator()
    expect(full.root.getObjectByName(RADIUS_INDICATOR_NAMES.reachMin)).toBeInstanceOf(Line)
    expect(full.root.getObjectByName(RADIUS_INDICATOR_NAMES.reachMax)).toBeInstanceOf(Line)
    expect(full.root.getObjectByName(RADIUS_INDICATOR_NAMES.reachEdges)).toBeUndefined()
    expectClose(full.reach.maxM, 20.44, 1e-9)

    const sector = indicator({
      ...PROVISIONAL_CRANE_LIMITS,
      turretRotationDeg: { min: -90, max: 90 },
    })
    const edges = sector.root.children.filter(
      (child) => child.name === RADIUS_INDICATOR_NAMES.reachEdges,
    )
    expect(edges).toHaveLength(2)
  })

  it('os pontos do arco máximo ficam no raio máximo', () => {
    const target = indicator()
    const arc = target.root.getObjectByName(RADIUS_INDICATOR_NAMES.reachMax) as Line
    const positions = arc.geometry.getAttribute('position')
    for (let index = 0; index < positions.count; index += 1) {
      expectClose(Math.hypot(positions.getX(index), positions.getZ(index)), 20.44, 1e-6)
    }
  })
})
