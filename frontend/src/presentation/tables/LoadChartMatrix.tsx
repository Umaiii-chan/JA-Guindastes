import { useMemo } from 'react'

import {
  buildLoadChartMatrix,
  capacityBand,
  capacityBandRanges,
} from '../../application/loadChart/loadChartMatrix'
import type { LoadChartPoint } from '../../application/loadChart/ports'
import { cx } from '../ui'
import { formatKg, formatMeters } from './format'
import styles from './LoadChartMatrix.module.css'

export interface LoadChartMatrixProps {
  readonly points: readonly LoadChartPoint[]
  /** Nome acessível da tabela (ex.: "Prévia de tabela.csv"). */
  readonly caption: string
  /** Versão menor, sem legenda detalhada (detalhe do catálogo). */
  readonly compact?: boolean
  readonly className?: string
}

/**
 * Matriz da tabela de carga como mapa de calor legível: linhas = comprimento da lança, colunas = raio
 * de trabalho, células com a capacidade máxima (kg) em mono tabular e fundo numa escala de um tom só
 * (ciano, do escuro ao claro, em 5 faixas da própria tabela). O número está sempre escrito: a cor só
 * ajuda a ler o padrão. Célula sem ponto na tabela: "—" (a tela não interpola; ADR-009).
 */
export function LoadChartMatrix({
  points,
  caption,
  compact = false,
  className,
}: LoadChartMatrixProps) {
  const matrix = useMemo(() => buildLoadChartMatrix(points), [points])
  if (matrix === null) return null
  const ranges = capacityBandRanges(matrix.minCapacityKg, matrix.maxCapacityKg)

  return (
    <figure className={cx(styles.figure, compact && styles.compact, className)}>
      <div className={styles.scroll} tabIndex={0} role="group" aria-label={`${caption} (rolável)`}>
        <table className={styles.matrix}>
          <caption className="visually-hidden">
            {caption}: capacidade máxima em kg por comprimento de lança (linhas) e raio de trabalho
            (colunas).
          </caption>
          <thead>
            <tr>
              <th scope="col" className={styles.corner}>
                <span className={styles.cornerRow}>Lança ↓</span>
                <span className={styles.cornerCol}>Raio →</span>
              </th>
              {matrix.radiiM.map((radius) => (
                <th key={radius} scope="col" className={styles.colHead}>
                  {formatMeters(radius)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.boomLengthsM.map((boom, row) => (
              <tr key={boom}>
                <th scope="row" className={styles.rowHead}>
                  {formatMeters(boom)}
                </th>
                {matrix.cells[row].map((value, column) => {
                  const radius = matrix.radiiM[column]
                  if (value === null) {
                    return (
                      <td
                        key={radius}
                        className={cx(styles.cell, styles.missing)}
                        title={`Lança ${formatMeters(boom)} · raio ${formatMeters(radius)}: sem ponto na tabela`}
                      >
                        <span aria-label="sem ponto">—</span>
                      </td>
                    )
                  }
                  const band = capacityBand(value, matrix.minCapacityKg, matrix.maxCapacityKg)
                  return (
                    <td
                      key={radius}
                      className={cx(styles.cell, styles[`band${band}`])}
                      data-band={band}
                      title={`Lança ${formatMeters(boom)} · raio ${formatMeters(radius)}: ${formatKg(value)}`}
                    >
                      {value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <figcaption className={styles.legend}>
        <span className={styles.legendTitle}>Capacidade máxima (kg)</span>
        <ol className={styles.legendScale} aria-label="Legenda de cores da capacidade">
          {ranges.map((range) => (
            <li key={range.band} className={styles.legendItem}>
              <span className={cx(styles.swatch, styles[`band${range.band}`])} aria-hidden="true" />
              {!compact && (
                <span className={styles.legendRange}>
                  {range.fromKg.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                  {'–'}
                  {range.toKg.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                </span>
              )}
            </li>
          ))}
        </ol>
        <span className={styles.legendMeta}>
          {matrix.pointCount} pontos · {matrix.boomLengthsM.length} lanças × {matrix.radiiM.length}{' '}
          raios · mín. {formatKg(matrix.minCapacityKg)} · máx. {formatKg(matrix.maxCapacityKg)}
        </span>
      </figcaption>
    </figure>
  )
}
