import type { ReactNode } from 'react'

import { cx } from './cx'
import { Skeleton } from './Skeleton'
import styles from './Table.module.css'

export interface TableColumn<Row> {
  readonly key: string
  readonly header: ReactNode
  readonly render: (row: Row, index: number) => ReactNode
  /** Número técnico: fonte mono tabular, alinhado à direita. */
  readonly numeric?: boolean
  readonly width?: number | string
}

export interface TableProps<Row> {
  readonly columns: readonly TableColumn<Row>[]
  readonly rows: readonly Row[]
  readonly rowKey: (row: Row, index: number) => string
  /** Legenda da tabela (nome acessível). */
  readonly caption: ReactNode
  /** Mostra a legenda na tela; sem isso, só leitores de tela a leem. */
  readonly showCaption?: boolean
  readonly loading?: boolean
  /** Quantas linhas-fantasma mostrar carregando. */
  readonly loadingRows?: number
  /** O que mostrar sem linhas (ex.: um `EmptyState`). */
  readonly empty?: ReactNode
  /** Altura máxima com rolagem e cabeçalho fixo. */
  readonly maxHeight?: number | string
  readonly dense?: boolean
  readonly className?: string
}

/** Tabela de dados: cabeçalho fixo, números em mono, estados de carregando e vazio. */
export function Table<Row>({
  columns,
  rows,
  rowKey,
  caption,
  showCaption = false,
  loading = false,
  loadingRows = 4,
  empty,
  maxHeight,
  dense = false,
  className,
}: TableProps<Row>) {
  const isEmpty = !loading && rows.length === 0

  return (
    <div className={cx(styles.wrap, className)} style={{ maxHeight }}>
      <table className={cx(styles.table, dense && styles.dense)} aria-busy={loading || undefined}>
        <caption className={showCaption ? styles.caption : 'visually-hidden'}>{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cx(column.numeric && styles.numeric)}
                style={{ width: column.width }}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading &&
            Array.from({ length: loadingRows }, (_, index) => (
              <tr key={`skeleton-${index}`} className={styles.skeletonRow}>
                {columns.map((column) => (
                  <td key={column.key}>
                    <Skeleton width={column.numeric ? '60%' : '80%'} />
                  </td>
                ))}
              </tr>
            ))}
          {!loading &&
            rows.map((row, index) => (
              <tr key={rowKey(row, index)}>
                {columns.map((column) => (
                  <td key={column.key} className={cx(column.numeric && styles.numeric)}>
                    {column.render(row, index)}
                  </td>
                ))}
              </tr>
            ))}
          {isEmpty && empty && (
            <tr>
              <td colSpan={columns.length} className={styles.emptyCell}>
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
