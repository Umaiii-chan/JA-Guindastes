import { describe, expect, it, vi } from 'vitest'

import { CraneController } from '../../../src/three/crane/CraneController'
import { createProvisionalCrane } from '../../../src/three/crane/createProvisionalCrane'
import {
  PROVISIONAL_CRANE_GEOMETRY,
  PROVISIONAL_CRANE_LIMITS,
} from '../../../src/three/crane/provisionalCraneSpec'
import { SwitchableCrane } from '../../../src/three/crane/SwitchableCrane'

function controller() {
  return new CraneController(
    createProvisionalCrane(),
    PROVISIONAL_CRANE_LIMITS,
    PROVISIONAL_CRANE_GEOMETRY,
  )
}

describe('SwitchableCrane', () => {
  it('repassa os comandos ao controller atual, com os mesmos limites e a/h', () => {
    const crane = new SwitchableCrane(controller())

    expect(crane.limits).toEqual(PROVISIONAL_CRANE_LIMITS)
    expect(crane.geometryParameters).toEqual(PROVISIONAL_CRANE_GEOMETRY)
    expect(crane.setBoomAngle(999)).toBe(PROVISIONAL_CRANE_LIMITS.boomAngleDeg.max)
    expect(crane.getState().boomAngleDeg).toBe(PROVISIONAL_CRANE_LIMITS.boomAngleDeg.max)
  })

  it('na troca, o rig novo nasce na pose atual e passa a receber os comandos', () => {
    const crane = new SwitchableCrane(controller())
    crane.setTurretRotation(30)
    crane.setBoomLength(18)
    const geometry = crane.getOperationalGeometry()
    const next = createProvisionalCrane()

    crane.switchTo(next)

    expect(crane.getState()).toMatchObject({ turretRotationDeg: 30, boomLengthM: 18 })
    expect(crane.getOperationalGeometry()).toEqual(geometry)
    expect(next.turret.rotation.y).toBeCloseTo(Math.PI / 6)
    crane.setTurretRotation(-90)
    expect(next.turret.rotation.y).toBeCloseTo(-Math.PI / 2)
  })

  it('chama afterCommand na troca e depois de cada comando', () => {
    const crane = new SwitchableCrane(controller())
    const afterCommand = vi.fn()

    crane.switchTo(createProvisionalCrane(), afterCommand)
    crane.setTurretRotation(1)
    crane.setBoomAngle(2)
    crane.setBoomLength(13)
    crane.setCableLength(4)

    expect(afterCommand).toHaveBeenCalledTimes(5)
  })
})
