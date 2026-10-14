import { CircleAlert } from 'lucide-react'

import { evaluationStatus } from '../../application/evaluation/evaluationStatus'
import type {
  EvaluationError,
  EvaluationResult,
  SafetyAlertSeverity,
  TippingRisk,
} from '../../domain/evaluation/evaluation'
import { TANDEM_CAPACITY_FACTOR } from '../../domain/tandem/tandem'
import type { TandemResult } from '../../domain/tandem/tandemEvaluation'
import { Badge, EmptyState, Spinner, StatusPill, type Tone } from '../ui'
import styles from './TandemHud.module.css'

export interface TandemHudProps {
  readonly result: TandemResult | null
  readonly error: EvaluationError | null
  readonly pending: boolean
  /** Nomes mostrados, na ordem dos guindastes ("Guindaste 1", "Guindaste 2"). */
  readonly labels: readonly [string, string]
}

const STATUS_PRESENTATION = {
  ok: { tone: 'ok', label: 'Dentro do limite' },
  warning: { tone: 'warning', label: 'Perto do limite' },
  over: { tone: 'danger', label: 'Acima do limite' },
  unknown: { tone: 'neutral', label: 'Sem avaliação' },
} as const satisfies Record<string, { tone: Tone; label: string }>

const RISK_PRESENTATION: Record<TippingRisk, { tone: Tone; label: string }> = {
  LOW: { tone: 'ok', label: 'Tombamento: baixo' },
  ATTENTION: { tone: 'warning', label: 'Tombamento: atenção' },
  HIGH: { tone: 'danger', label: 'Tombamento: alto' },
}

const ALERT_TONE: Record<SafetyAlertSeverity, { tone: Tone; label: string }> = {
  INFO: { tone: 'info', label: 'Informação' },
  ATTENTION: { tone: 'warning', label: 'Atenção' },
  CRITICAL: { tone: 'danger', label: 'Crítico' },
}

function format(value: number, digits = 0): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

/**
 * Ficha do içamento com dois guindastes (TASK-074; RN-016): como a carga se divide (kg e %), o uso
 * de cada guindaste sobre o que ele pode levantar em tandem (75 % da capacidade) e os alertas. Tudo
 * vem do servidor; a tela só mostra (RN-008).
 */
export function TandemHud({ result, error, pending, labels }: TandemHudProps) {
  const ok = result?.tandemOk === true
  return (
    <section
      className={styles.hud}
      aria-label="Avaliação do içamento em tandem"
      aria-busy={pending}
    >
      <header className={styles.header}>
        <h2 className={styles.title}>Içamento com dois guindastes</h2>
        <span
          className={styles.pending}
          style={{ visibility: pending ? 'visible' : 'hidden' }}
          aria-hidden={!pending}
        >
          <Spinner size={10} /> atualizando…
        </span>
        <span className={styles.spacer} aria-hidden="true" />
        <span className={styles.rule}>
          Cada guindaste usa no máximo {format(TANDEM_CAPACITY_FACTOR * 100)} % da própria
          capacidade
        </span>
        <StatusPill
          tone={result === null ? 'neutral' : ok ? 'ok' : 'danger'}
          size="lg"
          live
          pulse={result === null && pending}
        >
          {result === null ? 'Sem avaliação' : ok ? 'Içamento permitido' : 'Içamento não permitido'}
        </StatusPill>
      </header>

      {error !== null ? (
        <EmptyState
          compact
          tone="danger"
          role="alert"
          icon={<CircleAlert size={16} />}
          title="Não foi possível avaliar o içamento"
          description={error.message}
        />
      ) : result === null ? (
        <p className={styles.waiting}>Aguardando a avaliação do servidor…</p>
      ) : (
        <div className={styles.cells}>
          {result.evaluations.map((evaluation, index) => (
            <CraneCell
              key={index}
              label={labels[index] ?? `Guindaste ${index + 1}`}
              evaluation={evaluation}
              shareKg={result.sharesKg[index] ?? null}
              sharePercent={result.sharePercent[index] ?? null}
            />
          ))}
          <ul className={styles.alerts} aria-label="Alertas do içamento">
            {result.alerts.map((alert, index) => (
              <li
                key={`${alert.code}-${index}`}
                className={styles.alert}
                data-severity={alert.severity}
              >
                <Badge tone={ALERT_TONE[alert.severity].tone}>
                  {ALERT_TONE[alert.severity].label}
                </Badge>
                <span>{alert.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

function CraneCell({
  label,
  evaluation,
  shareKg,
  sharePercent,
}: {
  readonly label: string
  readonly evaluation: EvaluationResult
  readonly shareKg: number | null
  readonly sharePercent: number | null
}) {
  const status = evaluationStatus(evaluation)
  const presentation =
    evaluation.kind === 'NOT_EVALUABLE'
      ? { tone: 'neutral' as const, label: 'Não avaliável' }
      : STATUS_PRESENTATION[status]
  const limit = evaluation.kind === 'EVALUATED' ? (evaluation.capacityLimit ?? null) : null
  const used = limit?.limitUtilizationPercent ?? null
  return (
    <div className={styles.craneCell} data-status={status}>
      <div className={styles.craneHead}>
        <h3 className={styles.craneName}>{label}</h3>
        <StatusPill tone={presentation.tone} size="sm">
          {presentation.label}
        </StatusPill>
      </div>
      <dl className={styles.metrics}>
        <div className={styles.metric}>
          <dt>Parte da carga</dt>
          <dd>
            {shareKg === null ? '—' : `${format(shareKg)} kg`}
            {sharePercent !== null && (
              <span className={styles.percent}>{format(sharePercent, 1)} % da carga</span>
            )}
          </dd>
        </div>
        <div className={styles.metric}>
          <dt>Uso do permitido</dt>
          <dd>{used === null ? '—' : `${format(used, 1)} %`}</dd>
        </div>
        <div className={styles.metric}>
          <dt>Pode levantar</dt>
          <dd>{limit === null ? '—' : `${format(limit.effectiveCapacityKg)} kg`}</dd>
        </div>
        <div className={styles.metric}>
          <dt>Peso com o gancho</dt>
          <dd>
            {evaluation.comparedWeightKg === null || evaluation.comparedWeightKg === undefined
              ? '—'
              : `${format(evaluation.comparedWeightKg)} kg`}
          </dd>
        </div>
      </dl>
      {evaluation.tippingRisk != null && (
        <StatusPill tone={RISK_PRESENTATION[evaluation.tippingRisk].tone} size="sm">
          {RISK_PRESENTATION[evaluation.tippingRisk].label}
        </StatusPill>
      )}
    </div>
  )
}
