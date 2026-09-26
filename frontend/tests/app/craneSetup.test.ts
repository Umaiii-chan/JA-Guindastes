import { describe, expect, it } from 'vitest'

import { chooseCraneSetup, CONTINUOUS_TURRET_RANGE } from '../../src/app/craneSetup'
import type { CraneConfiguration } from '../../src/domain/catalog/catalog'
import {
  PROVISIONAL_CRANE_LIMITS,
  PROVISIONAL_CRANE_SETUP,
} from '../../src/three/crane/provisionalCraneSpec'
import { buildCraneScene } from '../../src/three/scene/buildCraneScene'
import { SHEET_FICTICIA, SHEET_MINIMA_FICTICIA } from '../fixtures/catalogFicticio'

const WITH_SHEET: CraneConfiguration = {
  id: 'CFG-FICTICIA',
  craneId: 'GUI-FICTICIO',
  name: 'Config FICTÍCIA',
  geometry: SHEET_FICTICIA,
}

describe('limites dos sliders a partir da configuração', () => {
  it('com ficha completa, limites e a/h vêm todos da ficha', () => {
    const choice = chooseCraneSetup(WITH_SHEET)

    expect(choice.fromSheet).toBe(true)
    expect(choice.setup).toEqual({
      limits: {
        turretRotationDeg: { min: -90, max: 90 },
        boomAngleDeg: { min: 5, max: 75 },
        boomLengthM: { min: 10, max: 30 },
        cableLengthM: { min: 0.5, max: 40 },
      },
      geometryParameters: { boomPivotOffsetM: 0.8, boomPivotHeightM: 2.6 },
    })
    expect(choice.notes).toEqual({})
    expect(choice.notice).toContain('ficha técnica de "Config FICTÍCIA"')
    expect(choice.notice).not.toContain('FICTÍCIOS do guindaste provisório')
  })

  it('sem limites de giro, o giro é contínuo; sem c_max, o máximo do cabo é FICTÍCIO e rotulado', () => {
    const choice = chooseCraneSetup({ ...WITH_SHEET, geometry: SHEET_MINIMA_FICTICIA })

    expect(choice.fromSheet).toBe(true)
    expect(choice.setup.limits.turretRotationDeg).toEqual(CONTINUOUS_TURRET_RANGE)
    expect(choice.setup.limits.cableLengthM).toEqual({
      min: 0.5,
      max: PROVISIONAL_CRANE_LIMITS.cableLengthM.max,
    })
    expect(choice.notes.turretRotationDeg).toContain('Giro contínuo')
    expect(choice.notes.cableLengthM).toContain('FICTÍCIO')
  })

  it('sem c_max e com c_min acima do máximo FICTÍCIO, o máximo acompanha o mínimo', () => {
    const choice = chooseCraneSetup({
      ...WITH_SHEET,
      geometry: { ...SHEET_MINIMA_FICTICIA, cableLengthMinM: 50 },
    })

    expect(choice.setup.limits.cableLengthM).toEqual({ min: 50, max: 50 })
  })

  it.each([
    ['nenhuma configuração', null, 'Nenhuma configuração escolhida'],
    ['configuração sem ficha', { ...WITH_SHEET, geometry: null }, 'não tem ficha técnica'],
    [
      'ficha com lança mínima 0 m',
      { ...WITH_SHEET, geometry: { ...SHEET_FICTICIA, boomLengthMinM: 0 } },
      'lança mínima de 0 m',
    ],
  ] as const)('%s: usa os FICTÍCIOS, rotulados', (_name, configuration, reason) => {
    const choice = chooseCraneSetup(configuration)

    expect(choice.fromSheet).toBe(false)
    expect(choice.setup).toBe(PROVISIONAL_CRANE_SETUP)
    expect(choice.notice).toContain(reason)
    expect(choice.notice).toContain('FICTÍCIOS')
  })

  it('a cena montada com a ficha limita os comandos e calcula com a/h da ficha', () => {
    const { crane, rig } = buildCraneScene(chooseCraneSetup(WITH_SHEET).setup)

    expect(crane.limits.boomLengthM).toEqual({ min: 10, max: 30 })
    expect(crane.geometryParameters).toEqual({ boomPivotOffsetM: 0.8, boomPivotHeightM: 2.6 })
    expect(rig.boomRetractedLengthM).toBe(10)
    expect(crane.setBoomLength(99)).toBe(30)
    expect(crane.setBoomAngle(0)).toBe(5)
    expect(crane.setTurretRotation(180)).toBe(90)
    expect(crane.setCableLength(100)).toBe(40)
    // Fórmula (1) do ADR-013 C-5 com a da ficha: R = a + L·cos θ = 0,8 + 30·cos 5°.
    expect(crane.getOperationalGeometry().workingRadiusM).toBeCloseTo(
      0.8 + 30 * Math.cos((5 * Math.PI) / 180),
      9,
    )
  })

  it('sem ficha, a cena usa os limites FICTÍCIOS de antes', () => {
    const { crane } = buildCraneScene(chooseCraneSetup(null).setup)

    expect(crane.limits).toEqual(PROVISIONAL_CRANE_LIMITS)
  })
})
