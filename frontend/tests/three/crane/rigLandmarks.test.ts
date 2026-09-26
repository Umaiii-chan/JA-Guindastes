import { BoxGeometry, Mesh, MeshStandardMaterial } from 'three'
import { describe, expect, it } from 'vitest'

import { createProvisionalCrane } from '../../../src/three/crane/createProvisionalCrane'
import {
  findOperatorEye,
  measureHookExtent,
  OPERATOR_EYE_ABOVE_GLASS_M,
} from '../../../src/three/crane/rigLandmarks'

describe('rigLandmarks', () => {
  it('mede o gancho provisório no referencial de G: vai de 0 a −1,1 m', () => {
    const rig = createProvisionalCrane()
    // Com a torre girada, a medida continua local ao gancho.
    rig.turret.rotation.y = 1

    const box = measureHookExtent(rig.hook)!

    expect(box.max.y).toBeCloseTo(0, 6)
    expect(box.min.y).toBeCloseTo(-1.1, 6)
    expect((box.min.x + box.max.x) / 2).toBeCloseTo(0, 6)
  })

  it('ignora os ramos excluídos (o próprio grupo da carga)', () => {
    const rig = createProvisionalCrane()
    const extra = new Mesh(new BoxGeometry(1, 10, 1))
    extra.position.y = -10
    rig.hook.add(extra)

    expect(measureHookExtent(rig.hook, [extra])!.min.y).toBeCloseTo(-1.1, 6)
    expect(measureHookExtent(rig.hook)!.min.y).toBeCloseTo(-15, 6)
  })

  it('sem vidro de cabine na torre, não há olho do operador medido', () => {
    expect(findOperatorEye(createProvisionalCrane())).toBeNull()
  })

  it('com vidro na torre, o olho fica acima do meio do vidro, no referencial da base', () => {
    const rig = createProvisionalCrane()
    const glass = new Mesh(new BoxGeometry(1, 2, 1), new MeshStandardMaterial({ name: 'vidro' }))
    glass.position.set(1, 1, 0.5)
    rig.turret.add(glass)
    // O giro atual da torre não muda o olho (ele é dado com ψ = 0).
    rig.turret.rotation.y = Math.PI / 2

    const eye = findOperatorEye(rig)!

    expect(eye.x).toBeCloseTo(rig.turret.position.x + 1, 6)
    expect(eye.y).toBeCloseTo(rig.turret.position.y + 2 + OPERATOR_EYE_ABOVE_GLASS_M, 6)
    expect(eye.z).toBeCloseTo(rig.turret.position.z + 0.5, 6)
  })
})
