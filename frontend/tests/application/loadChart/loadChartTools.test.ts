// Matriz, faixas de cor, comparação e conferência do arquivo das tabelas de carga (TASK-042), com
// pontos FICTÍCIOS.

import { describe, expect, it } from 'vitest'

import { compareLoadCharts } from '../../../src/application/loadChart/chartComparison'
import { checkLoadChartFile } from '../../../src/application/loadChart/chartFile'
import {
  buildLoadChartMatrix,
  CAPACITY_BAND_COUNT,
  capacityBand,
  capacityBandRanges,
} from '../../../src/application/loadChart/loadChartMatrix'
import type { LoadChartPoint } from '../../../src/application/loadChart/ports'

const point = (boomLengthM: number, workingRadiusM: number, maxCapacityKg: number) => ({
  boomLengthM,
  workingRadiusM,
  maxCapacityKg,
})

describe('buildLoadChartMatrix', () => {
  it('ordena lanças (linhas) e raios (colunas) e deixa null onde não há ponto', () => {
    const matrix = buildLoadChartMatrix([
      point(18, 6, 9000),
      point(12, 2, 11000),
      point(12, 6, 7000),
      point(18, 10, 5000),
    ])

    expect(matrix).not.toBeNull()
    expect(matrix?.boomLengthsM).toEqual([12, 18])
    expect(matrix?.radiiM).toEqual([2, 6, 10])
    expect(matrix?.cells).toEqual([
      [11000, 7000, null],
      [null, 9000, 5000],
    ])
    expect(matrix?.minCapacityKg).toBe(5000)
    expect(matrix?.maxCapacityKg).toBe(11000)
    expect(matrix?.pointCount).toBe(4)
  })

  it('sem pontos → null', () => {
    expect(buildLoadChartMatrix([])).toBeNull()
  })
})

describe('capacityBand e capacityBandRanges', () => {
  it('divide o intervalo da tabela em faixas iguais, com o máximo na última', () => {
    expect(capacityBand(1000, 1000, 6000)).toBe(0)
    expect(capacityBand(2999, 1000, 6000)).toBe(1)
    expect(capacityBand(6000, 1000, 6000)).toBe(CAPACITY_BAND_COUNT - 1)
    expect(capacityBand(3000, 3000, 3000)).toBe(2)
  })

  it('a legenda cobre do mínimo ao máximo', () => {
    const ranges = capacityBandRanges(1000, 6000)
    expect(ranges).toHaveLength(CAPACITY_BAND_COUNT)
    expect(ranges[0]).toEqual({ band: 0, fromKg: 1000, toKg: 2000 })
    expect(ranges.at(-1)).toEqual({ band: 4, fromKg: 5000, toKg: 6000 })
  })
})

describe('compareLoadCharts', () => {
  const v1: LoadChartPoint[] = [point(12, 2, 10000), point(12, 4, 8000), point(12, 6, 6000)]

  it('conta os pontos comuns que aumentam, diminuem e ficam iguais, com a maior variação', () => {
    const v2 = [point(12, 2, 9000), point(12, 4, 8800), point(12, 6, 6000), point(18, 6, 5000)]

    expect(compareLoadCharts(v1, v2)).toEqual({
      common: 3,
      increased: 1,
      decreased: 1,
      unchanged: 1,
      onlyInNext: 1,
      onlyInCurrent: 0,
      largestDropPercent: 10,
      largestRisePercent: 10,
    })
  })

  it('sem pontos em comum', () => {
    const comparison = compareLoadCharts(v1, [point(30, 20, 1000)])
    expect(comparison.common).toBe(0)
    expect(comparison.onlyInCurrent).toBe(3)
    expect(comparison.largestDropPercent).toBeNull()
  })
})

describe('checkLoadChartFile', () => {
  it('aceita CSV e XLSX (extensão sem diferenciar maiúsculas)', () => {
    expect(checkLoadChartFile({ name: 'tabela.csv', size: 10 })).toEqual({
      ok: true,
      format: 'CSV',
    })
    expect(checkLoadChartFile({ name: 'TABELA.XLSX', size: 10 })).toEqual({
      ok: true,
      format: 'XLSX',
    })
  })

  it('recusa outro formato, arquivo vazio e arquivo acima do limite', () => {
    const other = checkLoadChartFile({ name: 'tabela.pdf', size: 10 })
    expect(other.ok).toBe(false)
    expect(!other.ok && other.problem).toContain('não é CSV nem XLSX')

    const empty = checkLoadChartFile({ name: 'tabela.csv', size: 0 })
    expect(!empty.ok && empty.problem).toContain('está vazio')

    const big = checkLoadChartFile({ name: 'tabela.csv', size: 2048 }, 1024)
    expect(!big.ok && big.problem).toBe('"tabela.csv" tem 2 KiB; o limite é 1 KiB.')
  })
})
