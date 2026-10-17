// Geometria das lingas (F-19; ADR-051): paridade com o backend. A tabela de casos é UMA SÓ,
// `backend/tests/fixtures/sling_geometry_cases.json`, a mesma que `test_rigging.py` lê: se as duas
// implementações divergirem, um dos dois testes falha.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  belowRecommendedAngle,
  checkAngleDeg,
  defaultGeometry,
  fromAngle,
  fromLength,
  InvalidSlingGeometryError,
  MIN_DROP_M,
  needsSpreader,
  reachM,
  slingDropOf,
} from '../../../src/domain/rigging/slingGeometry'

interface Entrada {
  length_m: number
  width_m: number
  angle_deg?: number
  tandem?: boolean
}
interface Esperado {
  reach_m: number
  length_m: number
  angle_deg: number
  drop_m: number
  below_recommended_angle: boolean
  needs_spreader: boolean
}
interface Casos {
  tolerancia: number
  padrao: { nome: string; entrada: Entrada; esperado: Esperado }[]
  por_comprimento: {
    entrada: { reach_m: number; length_m: number }
    esperado: { reach_m: number; length_m: number; angle_deg: number; drop_m: number }
  }[]
  recusas: { nome: string; entrada: Entrada }[]
}

const FIXTURE = resolve(__dirname, '../../../../backend/tests/fixtures/sling_geometry_cases.json')
const casos = JSON.parse(readFileSync(FIXTURE, 'utf-8')) as Casos
const digits = -Math.log10(casos.tolerancia)

describe('paridade com o backend (tabela única de casos)', () => {
  it.each(casos.padrao.map((c) => [c.nome, c] as const))('%s', (_nome, caso) => {
    const { entrada, esperado } = caso
    const geometria = defaultGeometry(entrada.length_m, entrada.width_m, {
      angleDeg: entrada.angle_deg,
      tandem: entrada.tandem,
    })
    expect(geometria.reachM).toBeCloseTo(esperado.reach_m, digits - 1)
    expect(geometria.lengthM).toBeCloseTo(esperado.length_m, digits - 1)
    expect(geometria.angleDeg).toBeCloseTo(esperado.angle_deg, digits - 1)
    expect(geometria.dropM).toBeCloseTo(esperado.drop_m, digits - 1)
    expect(belowRecommendedAngle(geometria)).toBe(esperado.below_recommended_angle)
    expect(needsSpreader(geometria)).toBe(esperado.needs_spreader)
    expect(
      slingDropOf(entrada.length_m, entrada.width_m, {
        angleDeg: entrada.angle_deg,
        tandem: entrada.tandem,
      }),
    ).toBeCloseTo(esperado.drop_m, digits - 1)
  })

  it.each(casos.por_comprimento.map((c, i) => [i, c] as const))(
    'por comprimento #%i',
    (_i, caso) => {
      const geometria = fromLength(caso.entrada.reach_m, caso.entrada.length_m)
      expect(geometria.lengthM).toBeCloseTo(caso.esperado.length_m, digits - 1)
      expect(geometria.angleDeg).toBeCloseTo(caso.esperado.angle_deg, digits - 1)
      expect(geometria.dropM).toBeCloseTo(caso.esperado.drop_m, digits - 1)
    },
  )

  it.each(casos.recusas.map((c) => [c.nome, c] as const))('recusa: %s', (_nome, caso) => {
    const { entrada } = caso
    expect(() =>
      defaultGeometry(entrada.length_m, entrada.width_m, { angleDeg: entrada.angle_deg }),
    ).toThrow(InvalidSlingGeometryError)
  })
})

describe('propriedades da geometria única', () => {
  it('queda = r·tan α e L = r/cos α (sem o piso)', () => {
    const r = reachM(4, 2)
    const g = fromAngle(r, 55)
    expect(g.dropM).toBeCloseTo(r * Math.tan((55 * Math.PI) / 180), 9)
    expect(g.lengthM).toBeCloseTo(r / Math.cos((55 * Math.PI) / 180), 9)
  })

  it('a queda cresce com o ângulo e o comprimento com ele também', () => {
    const r = reachM(3, 2)
    const a = fromAngle(r, 40)
    const b = fromAngle(r, 70)
    expect(b.dropM).toBeGreaterThan(a.dropM)
    expect(b.lengthM).toBeGreaterThan(a.lengthM)
  })

  it('o piso da queda mantém o gancho fora da carga', () => {
    expect(defaultGeometry(0.2, 0.2).dropM).toBe(MIN_DROP_M)
  })

  it('no tandem cada guindaste ergue a sua metade: queda menor que a da carga inteira', () => {
    const inteira = defaultGeometry(12, 2.4, { angleDeg: 60 }).dropM
    const metade = defaultGeometry(12, 2.4, { angleDeg: 60, tandem: true }).dropM
    expect(metade).toBeLessThan(inteira)
  })

  it('ângulo fora de 30°–85° e medidas inválidas são recusados', () => {
    expect(() => checkAngleDeg(29.9)).toThrow(InvalidSlingGeometryError)
    expect(() => checkAngleDeg(85.1)).toThrow(InvalidSlingGeometryError)
    expect(() => reachM(0, 1)).toThrow(InvalidSlingGeometryError)
    expect(() => reachM(1, Number.NaN)).toThrow(InvalidSlingGeometryError)
    expect(() => fromLength(3, 2)).toThrow(InvalidSlingGeometryError)
  })
})
