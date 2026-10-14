// Zonas de giro na tela (TASK-046; ADR-018), com zonas FICTÍCIAS.

import { describe, expect, it } from 'vitest'

import {
  configurationChanges,
  isConfigurationFormField,
} from '../../../src/application/catalog/catalogForms'
import {
  emptyZoneRow,
  formatZoneSector,
  FRONT_110_REAR_250_PRESET,
  parseHookBlockWeight,
  parseZoneRows,
  rotationZonesCoverageProblem,
  zoneAtRotation,
  zoneRowsFrom,
  zoneSpanDeg,
} from '../../../src/application/catalog/rotationZones'
import { SHEET_FICTICIA, ZONAS_FICTICIAS } from '../../fixtures/catalogFicticio'

const zone = (code: string, startDeg: number, endDeg: number) => ({
  code,
  name: `Zona ${code}`,
  startDeg,
  endDeg,
})

describe('zonas de giro', () => {
  it('o atalho gera frontal de 305° a 55° (110°) e lateral/traseira de 55° a 305° (250°)', () => {
    expect(FRONT_110_REAR_250_PRESET.map((item) => [item.startDeg, item.endDeg])).toEqual([
      [305, 55],
      [55, 305],
    ])
    expect(FRONT_110_REAR_250_PRESET.map(zoneSpanDeg)).toEqual([110, 250])
    expect(rotationZonesCoverageProblem(FRONT_110_REAR_250_PRESET)).toBeNull()
    expect(formatZoneSector(FRONT_110_REAR_250_PRESET[0])).toBe('305° → 55° (110°)')
  })

  it('ψ escolhe a zona na pré-visualização, passando por 0° e com ψ negativo', () => {
    const zones = ZONAS_FICTICIAS
    expect(zoneAtRotation(zones, 0)?.code).toBe('FRONTAL')
    expect(zoneAtRotation(zones, 54.9)?.code).toBe('FRONTAL')
    expect(zoneAtRotation(zones, 55)?.code).toBe('LATERAL_TRASEIRA')
    expect(zoneAtRotation(zones, 180)?.code).toBe('LATERAL_TRASEIRA')
    expect(zoneAtRotation(zones, 305)?.code).toBe('FRONTAL')
    expect(zoneAtRotation(zones, -30)?.code).toBe('FRONTAL')
    expect(zoneAtRotation(zones, -90)?.code).toBe('LATERAL_TRASEIRA')
    expect(zoneAtRotation(zones, 720)?.code).toBe('FRONTAL')
    expect(zoneAtRotation([], 10)).toBeNull()
    expect(zoneAtRotation(zones, Number.NaN)).toBeNull()
  })

  it('cobertura: exige 2 zonas, sem lacuna e sem sobreposição', () => {
    expect(rotationZonesCoverageProblem([zone('A', 0, 0)])).toMatch(/pelo menos 2 zonas/)
    expect(rotationZonesCoverageProblem([zone('A', 0, 90), zone('B', 100, 0)])).toMatch(
      /Falta cobrir de 90° a 100°/,
    )
    expect(rotationZonesCoverageProblem([zone('A', 0, 120), zone('B', 100, 0)])).toMatch(
      /se sobrepõem/,
    )
    expect(rotationZonesCoverageProblem([zone('A', 10, 10), zone('B', 10, 20)])).toMatch(
      /mesmo ângulo/,
    )
    expect(
      rotationZonesCoverageProblem([zone('A', 0, 90), zone('B', 90, 200), zone('C', 200, 0)]),
    ).toBeNull()
  })

  it('o editor: sem linhas = sem zonas; com linhas, confere cada campo e a cobertura', () => {
    expect(parseZoneRows([])).toEqual({ zones: [], errors: null })
    expect(parseZoneRows(zoneRowsFrom(ZONAS_FICTICIAS))).toEqual({
      zones: ZONAS_FICTICIAS,
      errors: null,
    })

    const bad = parseZoneRows([
      { ...emptyZoneRow(), code: 'frontal', name: 'Frontal', startDeg: '305', endDeg: '55' },
      { ...emptyZoneRow(), code: 'X', name: '', startDeg: '360', endDeg: 'abc' },
    ])
    expect(bad.errors).toEqual({
      'rotationZones.0.code': 'Use de 1 a 32 caracteres: letras maiúsculas, números e _.',
      'rotationZones.1.name': 'Obrigatório.',
      'rotationZones.1.startDeg': 'Use de 0° até menos de 360°.',
      'rotationZones.1.endDeg': 'Informe um número.',
    })

    const repeated = parseZoneRows([
      { ...emptyZoneRow(), code: 'A', name: 'A', startDeg: '0', endDeg: '180' },
      { ...emptyZoneRow(), code: 'A', name: 'B', startDeg: '180', endDeg: '0' },
    ])
    expect(repeated.errors).toEqual({ 'rotationZones.1.code': 'Código repetido (zona 1).' })

    const gap = parseZoneRows([
      { ...emptyZoneRow(), code: 'A', name: 'A', startDeg: '0', endDeg: '170' },
      { ...emptyZoneRow(), code: 'B', name: 'B', startDeg: '180', endDeg: '0' },
    ])
    expect(gap.errors?.rotationZones).toMatch(/Falta cobrir de 170° a 180°/)
  })

  it('peso do gancho: vazio = não informado; de 0 a 100.000 kg', () => {
    expect(parseHookBlockWeight('')).toEqual({ value: null, error: null })
    expect(parseHookBlockWeight('180')).toEqual({ value: 180, error: null })
    expect(parseHookBlockWeight('0')).toEqual({ value: 0, error: null })
    expect(parseHookBlockWeight('-1').error).toBe('Não pode ser negativo.')
    expect(parseHookBlockWeight('100001').error).toMatch(/No máximo/)
    expect(parseHookBlockWeight('x').error).toBe('Informe um número.')
  })

  it('a alteração só leva as zonas e o gancho quando mudaram', () => {
    const original = {
      id: 'CFG-1',
      craneId: 'GUI-1',
      name: 'Config',
      geometry: SHEET_FICTICIA,
      rotationZones: ZONAS_FICTICIAS,
      hookBlockWeightKg: 180,
    }
    expect(
      configurationChanges(original, 'Config', SHEET_FICTICIA, {
        rotationZones: ZONAS_FICTICIAS.map((item) => ({ ...item })),
        hookBlockWeightKg: 180,
      }),
    ).toEqual({})
    expect(
      configurationChanges(original, 'Config', SHEET_FICTICIA, {
        rotationZones: [],
        hookBlockWeightKg: null,
      }),
    ).toEqual({ rotationZones: [], hookBlockWeightKg: null })
    expect(
      configurationChanges({ ...original, rotationZones: undefined }, 'Config', null, {
        rotationZones: FRONT_110_REAR_250_PRESET,
      }),
    ).toEqual({ rotationZones: FRONT_110_REAR_250_PRESET })
  })

  it('os erros das zonas e do gancho são campos do formulário da configuração', () => {
    expect(isConfigurationFormField('rotationZones')).toBe(true)
    expect(isConfigurationFormField('rotationZones.1.startDeg')).toBe(true)
    expect(isConfigurationFormField('hookBlockWeightKg')).toBe(true)
    expect(isConfigurationFormField('rotationZones.1.outro')).toBe(false)
  })
})
