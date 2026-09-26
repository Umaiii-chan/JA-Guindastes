import { ArrowDownRight, ArrowUpRight, Power } from 'lucide-react'
import { useMemo } from 'react'

import { compareLoadCharts } from '../../application/loadChart/chartComparison'
import type { LoadChartVersion } from '../../application/loadChart/chartVersions'
import { Button, Dialog, Notice } from '../ui'
import { formatNumber } from './format'
import styles from './tables.module.css'

export interface ActivationDialogProps {
  /** Versão a ativar; `null` fecha o Dialog. */
  readonly target: LoadChartVersion | null
  /** Versão ativa hoje, se a tela conhece alguma. */
  readonly current: LoadChartVersion | null
  readonly busy: boolean
  onConfirm(): void
  onCancel(): void
}

/**
 * Confirmação da ativação (CA-3). Explica a consequência: a capacidade calculada da configuração
 * passa a vir da versão nova, e a ativa hoje vira SUPERSEDED. Quando conhece as duas, compara os
 * pontos comuns (sem interpolar).
 */
export function ActivationDialog({
  target,
  current,
  busy,
  onConfirm,
  onCancel,
}: ActivationDialogProps) {
  const comparison = useMemo(
    () => (target && current ? compareLoadCharts(current.points, target.points) : null),
    [target, current],
  )

  return (
    <Dialog
      open={target !== null}
      onClose={busy ? () => undefined : onCancel}
      title={target ? `Ativar a versão ${target.version}?` : ''}
      description="A capacidade calculada muda: toda avaliação nova desta configuração passa a usar esta tabela."
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            Cancelar
          </Button>
          <Button variant="primary" icon={<Power size={15} />} loading={busy} onClick={onConfirm}>
            {target ? `Ativar ${target.version}` : 'Ativar'}
          </Button>
        </>
      }
    >
      {target && (
        <div className={styles.dialogBody}>
          <ul className={styles.consequences}>
            <li>
              A capacidade máxima que o simulador compara com a carga passa a vir da{' '}
              <strong>{target.version}</strong> (<code>{target.chartId}</code>,{' '}
              {target.points.length} pontos). Avaliações já exibidas não mudam; a próxima já usa a
              tabela nova.
            </li>
            <li>
              {current ? (
                <>
                  A <strong>{current.version}</strong>, ativa hoje, passa a{' '}
                  <strong>Substituída</strong> (SUPERSEDED) e deixa de valer.
                </>
              ) : (
                <>
                  Nenhuma versão ativa é conhecida por esta tela. Se a configuração tiver uma ativa
                  que não aparece aqui, ela também passa a Substituída.
                </>
              )}
            </li>
          </ul>
          {comparison && comparison.common > 0 && (
            <div className={styles.comparison} aria-label="Comparação com a versão ativa">
              <p className={styles.comparisonTitle}>
                Nos {comparison.common} pontos (lança, raio) presentes nas duas versões:
              </p>
              <ul className={styles.comparisonList}>
                <li data-trend="down">
                  <ArrowDownRight size={15} aria-hidden="true" />
                  <strong>{comparison.decreased}</strong> diminuem
                  {comparison.largestDropPercent !== null &&
                    ` (até −${formatNumber(comparison.largestDropPercent, 1)} %)`}
                </li>
                <li data-trend="up">
                  <ArrowUpRight size={15} aria-hidden="true" />
                  <strong>{comparison.increased}</strong> aumentam
                  {comparison.largestRisePercent !== null &&
                    ` (até +${formatNumber(comparison.largestRisePercent, 1)} %)`}
                </li>
                <li data-trend="same">
                  <strong>{comparison.unchanged}</strong> ficam iguais
                </li>
              </ul>
              {(comparison.onlyInNext > 0 || comparison.onlyInCurrent > 0) && (
                <p className={styles.comparisonNote}>
                  {comparison.onlyInNext} pontos só na {target.version}; {comparison.onlyInCurrent}{' '}
                  só na {current?.version}.
                </p>
              )}
            </div>
          )}
          <Notice tone="warning" compact>
            Tabelas de demonstração são FICTÍCIAS e a estratégia de cálculo é PROVISÓRIA (ADR-015).
          </Notice>
        </div>
      )}
    </Dialog>
  )
}
