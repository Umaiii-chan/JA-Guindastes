import { FileWarning } from 'lucide-react'

import type { LoadChartImportIssue } from '../../application/loadChart/ports'
import { Badge, Table } from '../ui'
import styles from './tables.module.css'

export interface ImportIssuesTableProps {
  readonly issues: readonly LoadChartImportIssue[]
  readonly fileName: string
}

/**
 * Relatório de inconsistências da importação (RNF-006), com linha e coluna do arquivo. Os problemas
 * do arquivo inteiro (sem linha) vêm primeiro; depois, pela linha.
 */
export function ImportIssuesTable({ issues, fileName }: ImportIssuesTableProps) {
  const rows = [...issues].sort((a, b) => (a.line ?? 0) - (b.line ?? 0))
  const lines = new Set(issues.map((issue) => issue.line).filter((line) => line !== null)).size

  return (
    <div className={styles.report}>
      <p className={styles.reportSummary}>
        <FileWarning size={15} aria-hidden="true" />
        <span>
          <strong>
            {issues.length} {issues.length === 1 ? 'problema' : 'problemas'}
          </strong>{' '}
          em {lines} {lines === 1 ? 'linha' : 'linhas'} de <code>{fileName}</code>. Nada foi
          gravado: corrija o arquivo e solte-o de novo.
        </span>
      </p>
      <Table
        caption={`Problemas encontrados em ${fileName}`}
        dense
        maxHeight={280}
        rows={rows}
        rowKey={(issue, index) =>
          `${issue.code}-${issue.line ?? 'arquivo'}-${issue.column ?? ''}-${index}`
        }
        columns={[
          {
            key: 'line',
            header: 'Linha',
            numeric: true,
            width: 72,
            render: (issue) =>
              issue.line === null ? <span className={styles.muted}>arquivo</span> : issue.line,
          },
          {
            key: 'column',
            header: 'Coluna',
            width: 170,
            render: (issue) =>
              issue.column === null ? (
                <span className={styles.muted}>—</span>
              ) : (
                <code className={styles.code}>{issue.column}</code>
              ),
          },
          {
            key: 'message',
            header: 'Problema',
            render: (issue) => (
              <span className={styles.issueMessage}>
                <span>{issue.message}</span>
                <Badge tone="danger" variant="outline">
                  {issue.code}
                </Badge>
              </span>
            ),
          },
        ]}
      />
    </div>
  )
}
