import { describe, expect, it, vi } from 'vitest'

import type {
  ConfigurationLoadCharts,
  StoredLoadChart,
} from '../../../src/application/loadChart/ports'
import {
  isTabulated,
  lengthsWithin,
  snapToTabulated,
  stepToTabulated,
  tabulatedBoomLengths,
} from '../../../src/application/loadChart/tabulatedBoomLengths'
import { loadTabulatedBoomLengths } from '../../../src/app/useTabulatedBoomLengths'

// FICTÍCIO: pontos de tabela de exemplo, não são de nenhum guindaste real.
const point = (boomLengthM: number, workingRadiusM: number) => ({
  boomLengthM,
  workingRadiusM,
  maxCapacityKg: 1000,
})

function chart(chartId: string, lengths: number[]): StoredLoadChart {
  return {
    chartId,
    version: 'v1',
    configurationId: 'cfg-ficticia',
    status: 'ACTIVE',
    points: lengths.flatMap((length) => [point(length, 3), point(length, 6)]),
    sourceFileName: 'ficticia.csv',
    rotationZoneCode: null,
  }
}

describe('comprimentos de lança tabelados (TASK-050)', () => {
  it('junta os comprimentos de todas as tabelas, sem repetir, em ordem crescente', () => {
    expect(tabulatedBoomLengths([chart('a', [22, 12, 17]), chart('b', [17, 27])])).toEqual([
      12, 17, 22, 27,
    ])
    expect(tabulatedBoomLengths([])).toEqual([])
  })

  it('encaixa no comprimento mais próximo', () => {
    const lengths = [12, 17, 22]
    expect(snapToTabulated(14.4, lengths)).toBe(12)
    expect(snapToTabulated(14.6, lengths)).toBe(17)
    expect(snapToTabulated(30, lengths)).toBe(22)
    expect(snapToTabulated(15, [])).toBe(15)
  })

  it('um passo pequeno (seta do teclado) vai ao vizinho na direção do movimento', () => {
    const lengths = [12, 17, 22]
    expect(stepToTabulated(17.1, 17, lengths)).toBe(22)
    expect(stepToTabulated(16.9, 17, lengths)).toBe(12)
    expect(stepToTabulated(21.9, 22, lengths)).toBe(17)
    expect(stepToTabulated(22.1, 22, lengths)).toBe(22)
    expect(stepToTabulated(20.5, 12, lengths)).toBe(22)
    expect(stepToTabulated(17, 17, lengths)).toBe(17)
  })

  it('filtra pelo curso da lança e reconhece comprimento tabelado', () => {
    expect(lengthsWithin([12, 17, 22, 27], { min: 12, max: 22 })).toEqual([12, 17, 22])
    expect(isTabulated(17, [12, 17])).toBe(true)
    expect(isTabulated(17.1, [12, 17])).toBe(false)
  })

  it('lê só as tabelas ativas da configuração', async () => {
    const listing: ConfigurationLoadCharts = {
      items: [],
      activeChartId: null,
      activeCharts: [
        { rotationZoneCode: 'FRONTAL', chartId: 'a' },
        { rotationZoneCode: 'LATERAL', chartId: 'b' },
      ],
    }
    const charts: Record<string, StoredLoadChart> = {
      a: chart('a', [12, 17]),
      b: chart('b', [17, 22]),
    }
    const gateway = {
      listConfigurationCharts: vi.fn(async () => listing),
      getChart: vi.fn(async (chartId: string) => charts[chartId]),
    }

    await expect(loadTabulatedBoomLengths(gateway, 'cfg-ficticia')).resolves.toEqual([12, 17, 22])
    expect(gateway.getChart).toHaveBeenCalledTimes(2)
  })
})
