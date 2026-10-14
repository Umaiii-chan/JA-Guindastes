// Comprimentos de lança tabelados (TASK-050). A consulta do backend só avalia um comprimento que seja
// coluna da tabela ativa (ADR-015; known-gaps L-004): entre colunas, o resultado é "Não avaliável".
// O slider da lança encaixa nesses comprimentos, sem interpolar nada (RN-004): a capacidade continua
// vindo só do backend (RN-008).

import type { LoadChartPoint } from './ports'

/** Tolerância para considerar dois comprimentos iguais (a mesma da consulta do backend). */
const SAME_LENGTH_M = 1e-6

/**
 * Comprimentos distintos, em ordem crescente, de todas as tabelas dadas (uma por zona de giro;
 * ADR-018). Com zonas, um comprimento que falte numa zona dá "Não avaliável" só nela.
 */
export function tabulatedBoomLengths(
  charts: readonly { readonly points: readonly LoadChartPoint[] }[],
): number[] {
  const lengths = charts.flatMap((chart) => chart.points.map((point) => point.boomLengthM))
  const sorted = [...lengths].sort((a, b) => a - b)
  return sorted.filter((value, index) => index === 0 || value - sorted[index - 1] > SAME_LENGTH_M)
}

/** Os comprimentos dentro do curso da lança [min, max]. */
export function lengthsWithin(
  lengths: readonly number[],
  range: { readonly min: number; readonly max: number },
): number[] {
  return lengths.filter(
    (value) => value >= range.min - SAME_LENGTH_M && value <= range.max + SAME_LENGTH_M,
  )
}

/** O comprimento tabelado mais próximo de `value`; sem comprimentos, o próprio `value`. */
export function snapToTabulated(value: number, lengths: readonly number[]): number {
  let best = value
  let bestDistance = Number.POSITIVE_INFINITY
  for (const length of lengths) {
    const distance = Math.abs(length - value)
    if (distance < bestDistance) {
      best = length
      bestDistance = distance
    }
  }
  return best
}

/**
 * O comprimento tabelado para um movimento do slider de `current` até `value`: o mais próximo de
 * `value`; se esse for o próprio `current` (um passo pequeno, como a seta do teclado), o vizinho na
 * direção do movimento, para o slider não ficar preso.
 */
export function stepToTabulated(
  value: number,
  current: number,
  lengths: readonly number[],
): number {
  const nearest = snapToTabulated(value, lengths)
  if (Math.abs(nearest - current) > SAME_LENGTH_M || Math.abs(value - current) <= SAME_LENGTH_M) {
    return nearest
  }
  const neighbor =
    value > current
      ? lengths.find((length) => length > current + SAME_LENGTH_M)
      : [...lengths].reverse().find((length) => length < current - SAME_LENGTH_M)
  return neighbor ?? nearest
}

/** `value` já é um comprimento tabelado. */
export function isTabulated(value: number, lengths: readonly number[]): boolean {
  return lengths.some((length) => Math.abs(length - value) <= SAME_LENGTH_M)
}
