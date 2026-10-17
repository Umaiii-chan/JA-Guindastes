// Distância mínima de rede elétrica (D4; ADR-051): paridade com o backend. A tabela de casos é UMA SÓ,
// `backend/tests/fixtures/power_line_clearance_cases.json`, a mesma que `test_power_line.py` lê.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  DEFAULT_POWER_LINE_HEIGHT_M,
  DEFAULT_POWER_LINE_VOLTAGE_KV,
  formatVoltageKv,
  isValidPowerLine,
  isValidVoltageKv,
  type PowerLine,
  POWER_LINE_VOLTAGE_OPTIONS_KV,
  powerLineLengthM,
  requiredClearanceM,
} from '../../../src/domain/environment/powerLine'

interface Casos {
  tolerancia: number
  casos: { tensao_kv: number; minima_m: number }[]
  fora_da_tabela_kv: number[]
}

const FIXTURE = resolve(
  __dirname,
  '../../../../backend/tests/fixtures/power_line_clearance_cases.json',
)
const casos = JSON.parse(readFileSync(FIXTURE, 'utf-8')) as Casos
const digits = Math.round(-Math.log10(casos.tolerancia))

const LINE: PowerLine = {
  id: 'r1',
  label: 'Rede FICTÍCIA',
  x1M: -10,
  z1M: 5,
  x2M: 10,
  z2M: 5,
  heightM: DEFAULT_POWER_LINE_HEIGHT_M,
  voltageKv: DEFAULT_POWER_LINE_VOLTAGE_KV,
}

describe('distância mínima de rede (paridade com o backend)', () => {
  it.each(casos.casos.map((c) => [`${c.tensao_kv} kV`, c] as const))('%s', (_nome, caso) => {
    expect(requiredClearanceM(caso.tensao_kv)).toBeCloseTo(caso.minima_m, digits - 1)
  })

  it.each(casos.fora_da_tabela_kv)('recusa %s kV (fora da tabela)', (kv) => {
    expect(requiredClearanceM(kv)).toBeNull()
    expect(isValidVoltageKv(kv)).toBe(false)
  })

  it('até 50 kV são 10 pés (3,05 m) e a distância cresce com a tensão', () => {
    expect(requiredClearanceM(50)).toBeCloseTo(3.048, 6)
    const values = POWER_LINE_VOLTAGE_OPTIONS_KV.map((kv) => requiredClearanceM(kv)!)
    expect([...values].sort((a, b) => a - b)).toEqual(values)
    expect(POWER_LINE_VOLTAGE_OPTIONS_KV.every(isValidVoltageKv)).toBe(true)
  })

  it('a Tabela A é em degraus: o limite da faixa pertence a ela (50 kV = 10 pés, 50,1 kV = 15 pés)', () => {
    expect(requiredClearanceM(50)).toBeCloseTo(10 * 0.3048, 9)
    expect(requiredClearanceM(50.1)).toBeCloseTo(15 * 0.3048, 9)
    expect(requiredClearanceM(200)).toBeCloseTo(15 * 0.3048, 9)
    expect(requiredClearanceM(1000)).toBeCloseTo(45 * 0.3048, 9)
  })
})

describe('trecho de rede', () => {
  it('mede o comprimento e valida as faixas do backend', () => {
    expect(powerLineLengthM(LINE)).toBe(20)
    expect(isValidPowerLine(LINE)).toBe(true)
    expect(isValidPowerLine({ ...LINE, x2M: LINE.x1M, z2M: LINE.z1M })).toBe(false)
    expect(isValidPowerLine({ ...LINE, heightM: 0.4 })).toBe(false)
    expect(isValidPowerLine({ ...LINE, heightM: 200.1 })).toBe(false)
    expect(isValidPowerLine({ ...LINE, voltageKv: 0 })).toBe(false)
    expect(isValidPowerLine({ ...LINE, voltageKv: 1000.1 })).toBe(false)
    expect(isValidPowerLine({ ...LINE, x1M: Number.NaN })).toBe(false)
  })

  it('formata a tensão em pt-BR', () => {
    expect(formatVoltageKv(13.8)).toBe('13,8 kV')
    expect(formatVoltageKv(138)).toBe('138 kV')
  })
})
