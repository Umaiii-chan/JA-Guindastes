import { useMemo } from 'react'

import {
  buildLoadChartMatrix,
  capacityBand,
  capacityBandRanges,
} from '../../application/loadChart/loadChartMatrix'
import type { LoadChartPoint } from '../../application/loadChart/ports'
import { cx } from '../ui'
import { formatKg, formatMeters, formatNumber } from './format'
import styles from './LoadChartMatrix.module.css'

export interface LoadChartMatrixProps {
  readonly points: readonly LoadChartPoint[]
  /** Nome acessível da tabela (ex.: "Prévia de tabela.csv"). */
  readonly caption: string
  /** Versão menor, sem legenda detalhada (detalhe do catálogo). */
  readonly compact?: boolean
  readonly className?: string
}

/** Número com a unidade num trecho menor (o texto continua "12 m", para leitores e testes). */
function Meters({ value }: { readonly value: number }) {
  return (
    <>
      {formatNumber(value)}
      <span className={styles.unit}> m</span>
    </>
  )
}

/**
 * Matriz da tabela de carga como a tabela impressa do fabricante (ADR-019): linhas = comprimento da
 * lança, colunas = raio de trabalho, capacidade máxima (kg) em mono tabular alinhada à direita, entre
 * filetes. O fundo é um mapa de calor sóbrio, 5 tons de uma rampa de cinza-quente sobre o papel (das
 * 5 faixas da própria tabela), e o peso da tinta sobe com a capacidade. O número está sempre escrito:
 * o tom só ajuda a ler o padrão. Célula sem ponto na tabela: "—" (a tela não interpola; ADR-009).
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
                <svg className={styles.cornerRule} aria-hidden="true" preserveAspectRatio="none">
                  <line x1="0" y1="0" x2="100%" y2="100%" />
                </svg>
                <span className={styles.cornerCol}>Raio</span>
                <span className={styles.cornerRow}>Lança</span>
              </th>
              {matrix.radiiM.map((radius) => (
                <th key={radius} scope="col" className={styles.colHead}>
                  <Meters value={radius} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.boomLengthsM.map((boom, row) => (
              <tr key={boom}>
                <th scope="row" className={styles.rowHead}>
                  <Meters value={boom} />
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
        <span className={styles.legendTitle}>
          Capacidade máx.<span className={styles.legendUnit}>kg</span>
        </span>
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
        {!compact && (
          <span className={styles.legendMissing}>
            <span className={styles.missingSwatch} aria-hidden="true">
              —
            </span>
            sem ponto (não interpola)
          </span>
        )}
        <span className={styles.legendMeta}>
          {matrix.pointCount} pontos · {matrix.boomLengthsM.length} lanças × {matrix.radiiM.length}{' '}
          raios · mín. {formatKg(matrix.minCapacityKg)} · máx. {formatKg(matrix.maxCapacityKg)}
        </span>
      </figcaption>
    </figure>
  )
}
