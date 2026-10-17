import { ChevronDown, ChevronRight, CircleAlert } from 'lucide-react'
import { type ReactNode, useId } from 'react'

import {
  evaluationStatus,
  FULL_CAPACITY_PERCENT,
} from '../../application/evaluation/evaluationStatus'
import {
  CONSERVATIVE_PROVISIONAL_STRATEGY,
  LINEAR_INTERPOLATION_STRATEGY,
  type EvaluationError,
  type EvaluationResult,
  type NotEvaluableResult,
  type SafetyAlertSeverity,
} from '../../domain/evaluation/evaluation'
import {
  Badge,
  cx,
  EmptyState,
  Gauge,
  type GaugeBand,
  Skeleton,
  Spinner,
  StatusPill,
  type Tone,
} from '../ui'
import { useResultDetails } from '../simulator/layout/resultDetails'
import styles from './BackendEvaluationPanel.module.css'
import { STATUS_PRESENTATION, TIPPING_RISK_PRESENTATION } from './evaluationPresentation'
import { reasonLabel } from './reasonLabels'

export type EvaluationTransportLabel = 'websocket' | 'rest'

export interface BackendEvaluationPanelProps {
  readonly result: EvaluationResult | null
  readonly error: EvaluationError | null
  /** Há estado mais novo que o mostrado a caminho do backend. */
  readonly pending: boolean
  readonly transport: EvaluationTransportLabel | null
  /** Por que o estado não está sendo enviado (ex.: configuração vazia); `null` se está. */
  readonly inputProblem: string | null
  /** Peso da carga enviado (kg), para mostrar ao lado da capacidade; `null` sem carga válida. */
  readonly loadWeightKg?: number | null
  /** O backend está demorando para responder (ex.: acordando no Render; TASK-050). */
  readonly slow?: boolean
}

export const SLOW_BACKEND_MESSAGE =
  'O servidor está demorando para responder. Se estava parado, ele leva até 1 minuto para acordar.'

export const PROVISIONAL_MARK = 'PROVISÓRIO — consulta conservadora'
export const INTERPOLATED_MARK = 'PROVISÓRIO — interpolado entre pontos da tabela'

const ALERT_PRESENTATION: Record<SafetyAlertSeverity, { tone: Tone; label: string }> = {
  INFO: { tone: 'info', label: 'Informação' },
  ATTENTION: { tone: 'warning', label: 'Atenção' },
  CRITICAL: { tone: 'danger', label: 'Crítico' },
}

function formatNumber(value: number, fractionDigits: number): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })
}

const meters = (value: number) => `${formatNumber(value, 2)} m`
const kilograms = (value: number) => `${formatNumber(value, 0)} kg`

/** Gravidade mais alta primeiro: o primeiro alerta é o que aparece no primeiro nível do cartão. */
const ALERT_ORDER: Record<SafetyAlertSeverity, number> = { CRITICAL: 0, ATTENTION: 1, INFO: 2 }

/**
 * Ficha do resultado OFICIAL, calculado no backend (RN-008), no cartão sobre a cena (TASK-095;
 * ADR-045, com o visual do ADR-019). No primeiro nível, o que se olha o tempo todo: a situação, a
 * régua da utilização, a capacidade, o peso comparado, o raio, o risco de tombamento e o alerta mais
 * grave. Em "Detalhes" (no HTML mesmo fechado), a conta carga + gancho + acessórios = peso comparado,
 * a zona de giro, o limite do modelo e a capacidade efetiva, todos os alertas e a consulta da tabela.
 * "Não avaliável" mostra os motivos (RN-007). A cor só compara o peso comparado com a capacidade; não
 * há níveis de alerta (PEND-004).
 */
export function BackendEvaluationPanel({
  result,
  error,
  pending,
  inputProblem,
  loadWeightKg = null,
  slow = false,
}: BackendEvaluationPanelProps) {
  const baseId = useId()
  const titleId = `${baseId}-title`
  const detailsId = `${baseId}-details`
  const details = useResultDetails()
  const shown = inputProblem === null && error === null ? result : null
  const status = evaluationStatus(shown)
  const presentation =
    shown?.kind === 'NOT_EVALUABLE'
      ? { tone: 'neutral' as const, label: 'Não avaliável' }
      : STATUS_PRESENTATION[status]
  const waitingFirst = inputProblem === null && error === null && result === null
  // Limite do modelo (TASK-051): a régua mede o peso comparado contra a capacidade EFETIVA.
  const limit = shown?.kind === 'EVALUATED' ? (shown.capacityLimit ?? null) : null
  const utilization =
    shown?.kind === 'EVALUATED'
      ? (limit?.limitUtilizationPercent ?? shown.utilizationPercent)
      : null
  const gaugeBands: readonly GaugeBand[] = limit
    ? [
        { from: 0, to: limit.warningBandPercent, tone: 'ok' },
        { from: limit.warningBandPercent, to: FULL_CAPACITY_PERCENT, tone: 'warning' },
      ]
    : [{ from: 0, to: FULL_CAPACITY_PERCENT, tone: 'ok' }]
  // Zona de giro usada pelo backend (TASK-046); some numa configuração sem zonas.
  const zoneLabel = shown ? (shown.rotationZoneName ?? shown.rotationZoneCode) : null
  const alerts = [...(shown?.alerts ?? [])].sort(
    (a, b) => ALERT_ORDER[a.severity] - ALERT_ORDER[b.severity],
  )
  const topAlert = alerts[0] ?? null
  const comparedWeight =
    shown?.comparedWeightKg !== null && shown?.comparedWeightKg !== undefined
      ? kilograms(shown.comparedWeightKg)
      : '—'
  const controls = [detailsId, details.extraId].filter(Boolean).join(' ')

  return (
    <section className={styles.hud} aria-labelledby={titleId} aria-busy={pending}>
      <header className={styles.header}>
        <h2 id={titleId} className={styles.title}>
          Avaliação
        </h2>
        <span
          className={styles.pending}
          style={{ visibility: pending ? 'visible' : 'hidden' }}
          aria-hidden={!pending}
        >
          <Spinner size={10} /> <span className={styles.pendingText}>atualizando…</span>
        </span>
        <span className={styles.headerSpacer} aria-hidden="true" />
        <StatusPill
          className={cx(styles.headerPill, styles.statusPill)}
          tone={presentation.tone}
          size="lg"
          live
          pulse={waitingFirst && pending}
        >
          {presentation.label}
        </StatusPill>
      </header>

      <div className={styles.summary}>
        <Gauge
          compact
          value={utilization}
          tone={presentation.tone}
          label="Utilização"
          bands={gaugeBands}
          caption={
            status === 'over'
              ? limit
                ? 'acima do limite'
                : 'acima de 100 %'
              : shown?.kind === 'NOT_EVALUABLE'
                ? 'sem utilização'
                : limit
                  ? `do limite de ${formatNumber(limit.limitPercent, 0)} %`
                  : undefined
          }
        />

        <dl className={styles.keyMetrics}>
          <Metric label="Capacidade" loading={waitingFirst && pending}>
            {shown?.capacity ? kilograms(shown.capacity.maximumCapacityKg) : '—'}
          </Metric>
          <Metric label="Peso comparado" loading={waitingFirst && pending}>
            {comparedWeight}
          </Metric>
          <Metric label="Raio" loading={waitingFirst && pending}>
            {shown?.workingRadiusM !== null && shown?.workingRadiusM !== undefined
              ? meters(shown.workingRadiusM)
              : '—'}
          </Metric>
        </dl>

        <div className={styles.badges}>
          {shown?.tippingRisk != null && (
            <StatusPill
              className={styles.riskPill}
              tone={TIPPING_RISK_PRESENTATION[shown.tippingRisk].tone}
              size="sm"
            >
              {TIPPING_RISK_PRESENTATION[shown.tippingRisk].label}
            </StatusPill>
          )}
          <span className={styles.headerSpacer} aria-hidden="true" />
          <span
            className={styles.kind}
            title="A tabela de carga cobre o estado"
            style={{ visibility: shown?.kind === 'EVALUATED' ? 'visible' : 'hidden' }}
            aria-hidden={shown?.kind !== 'EVALUATED'}
          >
            Avaliado
          </span>
        </div>
      </div>

      {inputProblem !== null ? (
        <EmptyState
          compact
          className={styles.note}
          tone="neutral"
          icon={<ChevronRight size={16} />}
          title="Aguardando os passos"
          description={inputProblem}
        />
      ) : error !== null ? (
        <EmptyState
          compact
          className={styles.note}
          tone="danger"
          role="alert"
          icon={<CircleAlert size={16} />}
          title="Não foi possível avaliar"
          description={
            <>
              {error.message} <code>{error.code}</code>
            </>
          }
        />
      ) : result === null ? (
        <p className={styles.waiting}>Aguardando a primeira avaliação do servidor…</p>
      ) : result.kind === 'NOT_EVALUABLE' ? (
        <NotEvaluableReasons result={result} />
      ) : null}

      {/* Com os detalhes abertos, a lista completa dos alertas está logo abaixo. */}
      {topAlert !== null && !details.open && (
        <p className={styles.topAlert} data-severity={topAlert.severity}>
          <Badge tone={ALERT_PRESENTATION[topAlert.severity].tone}>
            {ALERT_PRESENTATION[topAlert.severity].label}
          </Badge>
          <span className={styles.topAlertText}>{topAlert.message}</span>
          {alerts.length > 1 && (
            <span className={styles.moreAlerts}>+{alerts.length - 1} em Detalhes</span>
          )}
        </p>
      )}

      {slow && pending && inputProblem === null && (
        <p className={styles.waiting} role="status">
          {SLOW_BACKEND_MESSAGE}
        </p>
      )}

      <button
        type="button"
        className={styles.detailsToggle}
        aria-expanded={details.open}
        aria-controls={controls}
        onClick={details.toggle}
      >
        <ChevronDown size={14} aria-hidden="true" data-open={details.open || undefined} />
        Detalhes
      </button>

      <div id={detailsId} className={styles.details} hidden={!details.open}>
        <div className={styles.parts} role="group" aria-label="Peso comparado com a capacidade">
          <dl className={styles.part}>
            <Metric label="Carga">{loadWeightKg === null ? '—' : kilograms(loadWeightKg)}</Metric>
          </dl>
          <span className={styles.partsOperator} aria-hidden="true">
            +
          </span>
          <dl className={styles.part}>
            <Metric label="Gancho">
              {shown?.hookBlockWeightKg !== null && shown?.hookBlockWeightKg !== undefined
                ? kilograms(shown.hookBlockWeightKg)
                : '—'}
            </Metric>
          </dl>
          {shown?.accessoriesWeightKg !== null && shown?.accessoriesWeightKg !== undefined && (
            <>
              <span className={styles.partsOperator} aria-hidden="true">
                +
              </span>
              <dl className={styles.part}>
                <Metric label="Acessórios">{kilograms(shown.accessoriesWeightKg)}</Metric>
              </dl>
            </>
          )}
          <span className={styles.partsOperator} aria-hidden="true">
            =
          </span>
          <dl className={cx(styles.part, styles.partTotal)}>
            <Metric label="Peso comparado">{comparedWeight}</Metric>
          </dl>
        </div>

        {(zoneLabel !== null || limit) && (
          <dl className={styles.detailMetrics} aria-label="Zona de giro e limite do modelo">
            {zoneLabel !== null && (
              <Metric label="Zona de giro">
                <span className={styles.zoneValue} title={shown?.rotationZoneCode ?? undefined}>
                  {zoneLabel}
                </span>
              </Metric>
            )}
            {limit && (
              <>
                <Metric label="Limite do modelo">{formatNumber(limit.limitPercent, 0)} %</Metric>
                <Metric label="Capacidade efetiva">{kilograms(limit.effectiveCapacityKg)}</Metric>
              </>
            )}
          </dl>
        )}
        {limit && reductionNotes(limit).length > 0 && (
          <p className={styles.meta} role="note">
            Capacidade {reductionNotes(limit).join(' e ')}.
          </p>
        )}

        {alerts.length > 0 && (
          <ul className={styles.alerts} aria-label="Alertas de segurança">
            {alerts.map((alert) => (
              <li key={alert.code} className={styles.alert} data-severity={alert.severity}>
                <Badge tone={ALERT_PRESENTATION[alert.severity].tone}>
                  {ALERT_PRESENTATION[alert.severity].label}
                </Badge>
                <span>{alert.message}</span>
              </li>
            ))}
          </ul>
        )}

        {inputProblem === null && error === null && result !== null && (
          <EvaluationDetails result={result} />
        )}
      </div>
    </section>
  )
}

function Metric({
  label,
  loading = false,
  children,
}: {
  readonly label: string
  readonly loading?: boolean
  readonly children: ReactNode
}) {
  return (
    <div className={styles.metric}>
      <dt>{label}</dt>
      <dd>{loading ? <Skeleton width="80%" height={16} /> : children}</dd>
    </div>
  )
}

function EvaluationDetails({ result }: { readonly result: EvaluationResult }) {
  const capacity = result.capacity
  const rows: { label: string; value: string }[] = []
  if (capacity) {
    rows.push({ label: 'Capacidade admissível', value: kilograms(capacity.maximumCapacityKg) })
  }
  if (result.kind === 'EVALUATED') {
    rows.push({ label: 'Utilização', value: `${formatNumber(result.utilizationPercent, 2)} %` })
  }
  const limit = result.capacityLimit
  if (limit) {
    rows.push(
      {
        label: 'Limite do modelo',
        value: `${formatNumber(limit.limitPercent, 0)} % (atenção a partir de ${formatNumber(limit.warningBandPercent, 0)} % do limite)`,
      },
      { label: 'Capacidade efetiva', value: kilograms(limit.effectiveCapacityKg) },
      ...reductionNotes(limit).map((note) => ({ label: 'Capacidade', value: note })),
      {
        label: 'Utilização do limite',
        value: `${formatNumber(limit.limitUtilizationPercent, 2)} %`,
      },
    )
  }
  if (result.rotationZoneCode !== null || result.rotationZoneName !== null) {
    rows.push({
      label: 'Zona de giro',
      value: [result.rotationZoneName, result.rotationZoneCode && `(${result.rotationZoneCode})`]
        .filter(Boolean)
        .join(' '),
    })
  }
  if (result.comparedWeightKg !== null) {
    rows.push({
      label: 'Peso comparado (carga + gancho)',
      value: `${kilograms(result.comparedWeightKg)}${result.hookBlockWeightKg !== null ? ` (gancho ${kilograms(result.hookBlockWeightKg)})` : ''}`,
    })
  }
  if (result.accessories !== undefined && result.accessories.length > 0) {
    rows.push({
      label: 'Acessórios de içamento',
      value: result.accessories
        .map((item) => `${item.name} ${kilograms(item.weightKg)}`)
        .join(' · '),
    })
  }
  if (result.workingRadiusM !== null) {
    rows.push({ label: 'Raio de trabalho', value: meters(result.workingRadiusM) })
  }
  if (capacity?.queriedRadiusM !== null && capacity?.queriedRadiusM !== undefined) {
    rows.push({ label: 'Raio consultado', value: meters(capacity.queriedRadiusM) })
  }
  if (capacity?.usedPoint) {
    const point = capacity.usedPoint
    rows.push({
      label: 'Ponto tabelado usado',
      value: `L ${meters(point.boomLengthM)} · R ${meters(point.workingRadiusM)} · ${kilograms(point.maxCapacityKg)}`,
    })
  }
  if (capacity) {
    rows.push({
      label: 'Estratégia',
      value:
        capacity.strategy === CONSERVATIVE_PROVISIONAL_STRATEGY
          ? 'ponto da tabela'
          : capacity.strategy === LINEAR_INTERPOLATION_STRATEGY
            ? 'interpolada entre pontos da tabela'
            : (capacity.strategy ?? '—'),
    })
  }
  if (result.loadChartId !== null || result.loadChartVersion !== null) {
    rows.push({
      label: 'Tabela de carga',
      value: `${result.loadChartId ?? '—'} (versão ${result.loadChartVersion ?? '—'})`,
    })
  }

  if (rows.length === 0) return null
  return (
    <div className={styles.query}>
      <p className={styles.queryTitle}>Detalhes da consulta</p>
      <dl className={styles.rows}>
        {rows.map((row) => (
          <div className={styles.row} key={row.label}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
      {result.kind === 'EVALUATED' && (
        <p className={cx(styles.meta, styles.detailsNote)}>
          {result.capacityLimit
            ? 'A cor é o nível devolvido pelo servidor: o peso comparado (carga + gancho) contra a capacidade efetiva do modelo.'
            : 'A cor compara o peso comparado (carga + gancho) com a capacidade da tabela.'}
        </p>
      )}
    </div>
  )
}

/** Motivos do "não avaliável" (RN-007), no primeiro nível do cartão. */
function NotEvaluableReasons({ result }: { readonly result: NotEvaluableResult }) {
  return (
    <div className={styles.reasons}>
      <p>
        Motivos
        {result.rotationZoneName !== null || result.rotationZoneCode !== null
          ? ` (zona ${result.rotationZoneName ?? result.rotationZoneCode})`
          : ''}
        :
      </p>
      <ul>
        {result.reasons.map((reason, index) => (
          <li key={`${reason.code}-${index}`}>{reasonLabel(reason.code)}</li>
        ))}
      </ul>
    </div>
  )
}

/** Avisos em linguagem simples dos fatores do ambiente que reduzem a capacidade (RN-015). */
function reductionNotes(limit: {
  readonly slopeFactor?: number
  readonly windFactor?: number
}): string[] {
  const notes: string[] = []
  if (limit.windFactor !== undefined && limit.windFactor < 1) {
    notes.push(`reduzida pelo vento (${formatNumber(limit.windFactor * 100, 0)} % do normal)`)
  }
  if (limit.slopeFactor !== undefined && limit.slopeFactor < 1) {
    notes.push(`reduzida pela inclinação (${formatNumber(limit.slopeFactor * 100, 0)} % do normal)`)
  }
  return notes
}
