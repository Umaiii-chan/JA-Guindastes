// Matriz lança × raio de uma tabela de carga (TASK-042), para a prévia colorida por capacidade.
// Só reorganiza os pontos que o backend devolveu: não interpola nem completa célula nenhuma (a
// interpolação é regra do backend, RN-004/ADR-009). Célula sem ponto fica `null`.

import type { LoadChartPoint } from './ports'

export interface LoadChartMatrix {
  /** Comprimentos de lança, em ordem crescente (linhas). */
  readonly boomLengthsM: readonly number[]
  /** Raios de trabalho, em ordem crescente (colunas). */
  readonly radiiM: readonly number[]
  /** `cells[linha][coluna]`: capacidade máxima em kg, ou `null` sem ponto na tabela. */
  readonly cells: readonly (readonly (number | null)[])[]
  readonly minCapacityKg: number
  readonly maxCapacityKg: number
  readonly pointCount: number
}

/** Quantas faixas de cor a legenda tem. */
export const CAPACITY_BAND_COUNT = 5

/** Monta a matriz; `null` quando não há pontos. Ponto repetido: vale o último (não deve ocorrer). */
export function buildLoadChartMatrix(points: readonly LoadChartPoint[]): LoadChartMatrix | null {
  if (points.length === 0) return null
  const boomLengthsM = uniqueSorted(points.map((point) => point.boomLengthM))
  const radiiM = uniqueSorted(points.map((point) => point.workingRadiusM))
  const rowOf = new Map(boomLengthsM.map((value, index) => [value, index]))
  const columnOf = new Map(radiiM.map((value, index) => [value, index]))
  const cells: (number | null)[][] = boomLengthsM.map(() => radiiM.map(() => null))
  let min = Infinity
  let max = -Infinity
  for (const point of points) {
    const row = rowOf.get(point.boomLengthM)
    const column = columnOf.get(point.workingRadiusM)
    if (row === undefined || column === undefined) continue
    cells[row][column] = point.maxCapacityKg
    min = Math.min(min, point.maxCapacityKg)
    max = Math.max(max, point.maxCapacityKg)
  }
  return {
    boomLengthsM,
    radiiM,
    cells,
    minCapacityKg: min,
    maxCapacityKg: max,
    pointCount: points.length,
  }
}

/**
 * Faixa de cor da capacidade (0 = menor, `CAPACITY_BAND_COUNT - 1` = maior), em faixas de largura igual
 * entre o mínimo e o máximo da própria tabela. Tabela com um valor só: faixa do meio.
 */
export function capacityBand(valueKg: number, minKg: number, maxKg: number): number {
  if (maxKg <= minKg) return Math.floor(CAPACITY_BAND_COUNT / 2)
  const ratio = (valueKg - minKg) / (maxKg - minKg)
  return Math.min(CAPACITY_BAND_COUNT - 1, Math.max(0, Math.floor(ratio * CAPACITY_BAND_COUNT)))
}

export interface CapacityBandRange {
  readonly band: number
  readonly fromKg: number
  readonly toKg: number
}

/** Limites de cada faixa, para a legenda. */
export function capacityBandRanges(minKg: number, maxKg: number): readonly CapacityBandRange[] {
  const step = (maxKg - minKg) / CAPACITY_BAND_COUNT
  return Array.from({ length: CAPACITY_BAND_COUNT }, (_, band) => ({
    band,
    fromKg: minKg + step * band,
    toKg: band === CAPACITY_BAND_COUNT - 1 ? maxKg : minKg + step * (band + 1),
  }))
}

function uniqueSorted(values: readonly number[]): number[] {
  return [...new Set(values)].sort((a, b) => a - b)
}
