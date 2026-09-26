// Comparação entre a tabela ativa e a que vai ser ativada (TASK-042), para o Dialog de ativação
// mostrar o quanto a capacidade muda. Só compara os pontos com a mesma lança e o mesmo raio; não
// interpola (a interpolação é do backend, ADR-009).

import type { LoadChartPoint } from './ports'

export interface LoadChartComparison {
  /** Pontos (lança, raio) presentes nas duas tabelas. */
  readonly common: number
  readonly increased: number
  readonly decreased: number
  readonly unchanged: number
  /** Pontos que só existem na tabela nova, ou só na atual. */
  readonly onlyInNext: number
  readonly onlyInCurrent: number
  /** Maior redução relativa num ponto comum, em % (positivo), ou `null` se nenhum diminui. */
  readonly largestDropPercent: number | null
  /** Maior aumento relativo num ponto comum, em %, ou `null` se nenhum aumenta. */
  readonly largestRisePercent: number | null
}

export function compareLoadCharts(
  current: readonly LoadChartPoint[],
  next: readonly LoadChartPoint[],
): LoadChartComparison {
  const key = (point: LoadChartPoint) => `${point.boomLengthM}|${point.workingRadiusM}`
  const currentByKey = new Map(current.map((point) => [key(point), point.maxCapacityKg]))
  const nextKeys = new Set<string>()
  let common = 0
  let increased = 0
  let decreased = 0
  let largestDrop: number | null = null
  let largestRise: number | null = null

  for (const point of next) {
    const pointKey = key(point)
    nextKeys.add(pointKey)
    const before = currentByKey.get(pointKey)
    if (before === undefined) continue
    common += 1
    const after = point.maxCapacityKg
    if (after === before) continue
    const percent = before === 0 ? 100 : (Math.abs(after - before) / before) * 100
    if (after < before) {
      decreased += 1
      largestDrop = Math.max(largestDrop ?? 0, percent)
    } else {
      increased += 1
      largestRise = Math.max(largestRise ?? 0, percent)
    }
  }

  return {
    common,
    increased,
    decreased,
    unchanged: common - increased - decreased,
    onlyInNext: nextKeys.size - common,
    onlyInCurrent: [...currentByKey.keys()].filter((pointKey) => !nextKeys.has(pointKey)).length,
    largestDropPercent: largestDrop,
    largestRisePercent: largestRise,
  }
}
