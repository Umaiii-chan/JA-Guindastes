import { ChevronRight, CircleAlert } from 'lucide-react'
import { type ReactNode, useId } from 'react'

import {
  type EvaluationStatus,
  evaluationStatus,
  FULL_CAPACITY_PERCENT,
} from '../../application/evaluation/evaluationStatus'
import {
  CONSERVATIVE_PROVISIONAL_STRATEGY,
  LINEAR_INTERPOLATION_STRATEGY,
  type EvaluationError,
  type EvaluationResult,
  type SafetyAlertSeverity,
  type TippingRisk,
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
import styles from './BackendEvaluationPanel.module.css'

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
  'O backend está demorando para responder. Se estava parado, ele leva até 1 minuto para acordar.'

export const PROVISIONAL_MARK = 'PROVISÓRIO — consulta conservadora (ADR-015)'
export const INTERPOLATED_MARK = 'PROVISÓRIO — interpolado entre pontos da tabela (ADR-030)'

const TRANSPORT_LABEL: Record<EvaluationTransportLabel, string> = {
  websocket: 'WebSocket',
  rest: 'REST',
}

/**
 * Cor e texto de cada situação (ADR-019 § 1). Com `capacityLimit` (TASK-051; RN-011), a situação é o
 * nível que o backend devolveu (`OK`, `WARNING`, `OVER`); sem ele, só `ok` e `over`.
 */
const STATUS_PRESENTATION: Record<EvaluationStatus, { tone: Tone; label: string }> = {
  ok: { tone: 'ok', label: 'Dentro da capacidade' },
  warning: { tone: 'warning', label: 'Perto do limite' },
  over: { tone: 'danger', label: 'Acima da capacidade' },
  unknown: { tone: 'neutral', label: 'Sem avaliação' },
}

/** Selo do risco de tombamento por regras (RN-013; TASK-055): cor e texto de cada nível. */
const TIPPING_RISK_PRESENTATION: Record<TippingRisk, { tone: Tone; label: string }> = {
  LOW: { tone: 'ok', label: 'Risco de tombamento: baixo' },
  ATTENTION: { tone: 'warning', label: 'Risco de tombamento: atenção' },
  HIGH: { tone: 'danger', label: 'Risco de tombamento: alto' },
}

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

/**
 * Ficha do resultado OFICIAL, calculado no backend (RN-008), como o carimbo de uma prancha
 * (ADR-019): faixa de título com a situação; célula da utilização (número grande em mono e a régua
 * graduada); célula dos valores (capacidade, zona, raio e a conta carga + gancho = peso comparado);
 * célula das notas (motivos, detalhes da consulta e a nota PROVISÓRIO da consulta conservadora,
 * ADR-015). "Não avaliável" mostra os motivos (RN-007). Com zonas de giro (TASK-046), mostra a zona
 * usada e as parcelas do peso comparado, todas vindas do backend. A cor só compara o peso comparado
 * com a capacidade; não há níveis de alerta (PEND-004).
 */
export function BackendEvaluationPanel({
  result,
  error,
  pending,
  transport,
  inputProblem,
  loadWeightKg = null,
  slow = false,
}: BackendEvaluationPanelProps) {
  const titleId = `${useId()}-title`
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
  const interpolated = shown?.capacity?.strategy === LINEAR_INTERPOLATION_STRATEGY

  return (
    <section className={styles.hud} aria-labelledby={titleId} aria-busy={pending}>
      <header className={styles.header}>
        <h2 id={titleId} className={styles.title}>
          Avaliação <Badge tone="info">backend</Badge>
        </h2>
        {pending && (
          <span className={styles.pending}>
            <Spinner size={10} /> atualizando…
          </span>
        )}
        <span className={styles.headerSpacer} aria-hidden="true" />
        {shown?.kind === 'EVALUATED' && (
          <span className={styles.kind} title="A tabela de carga cobre o estado">
            Avaliado
          </span>
        )}
        {shown?.tippingRisk != null && (
          <StatusPill tone={TIPPING_RISK_PRESENTATION[shown.tippingRisk].tone} size="lg">
            {TIPPING_RISK_PRESENTATION[shown.tippingRisk].label}
          </StatusPill>
        )}
        <StatusPill tone={presentation.tone} size="lg" live pulse={waitingFirst && pending}>
          {presentation.label}
        </StatusPill>
      </header>

      <div className={styles.cells}>
        <div className={cx(styles.cell, styles.cellUtilization)}>
          <Gauge
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
        </div>

        <div className={cx(styles.cell, styles.cellValues)}>
          <dl className={styles.keyMetrics}>
            <Metric label="Capacidade" loading={waitingFirst && pending}>
              {shown?.capacity ? kilograms(shown.capacity.maximumCapacityKg) : '—'}
            </Metric>
            {zoneLabel !== null && (
              <Metric label="Zona de giro">
                <span className={styles.zoneValue} title={shown?.rotationZoneCode ?? undefined}>
                  {zoneLabel}
                </span>
              </Metric>
            )}
            <Metric label="Raio (backend)" loading={waitingFirst && pending}>
              {shown?.workingRadiusM !== null && shown?.workingRadiusM !== undefined
                ? meters(shown.workingRadiusM)
                : '—'}
            </Metric>
          </dl>

          {limit && (
            <dl className={styles.keyMetrics} aria-label="Limite de capacidade do modelo">
              <Metric label="Limite do modelo">{formatNumber(limit.limitPercent, 0)} %</Metric>
              <Metric label="Capacidade efetiva">{kilograms(limit.effectiveCapacityKg)}</Metric>
            </dl>
          )}

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
            <span className={styles.partsOperator} aria-hidden="true">
              =
            </span>
            <dl className={cx(styles.part, styles.partTotal)}>
              <Metric label="Peso comparado">
                {shown?.comparedWeightKg !== null && shown?.comparedWeightKg !== undefined
                  ? kilograms(shown.comparedWeightKg)
                  : '—'}
              </Metric>
            </dl>
          </div>
        </div>

        <div className={cx(styles.cell, styles.cellNotes)}>
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
            <p className={styles.waiting}>Aguardando a primeira avaliação do backend…</p>
          ) : (
            <EvaluationDetails result={result} />
          )}

          {shown !== null && shown.alerts !== undefined && shown.alerts.length > 0 && (
            <ul className={styles.alerts} aria-label="Alertas de segurança">
              {shown.alerts.map((alert) => (
                <li key={alert.code} className={styles.alert} data-severity={alert.severity}>
                  <Badge tone={ALERT_PRESENTATION[alert.severity].tone}>
                    {ALERT_PRESENTATION[alert.severity].label}
                  </Badge>
                  <span>{alert.message}</span>
                </li>
              ))}
            </ul>
          )}

          {slow && pending && inputProblem === null && (
            <p className={styles.waiting} role="status">
              {SLOW_BACKEND_MESSAGE}
            </p>
          )}

          <p className={styles.provisional} role="note">
            <strong>
              <span className={styles.provisionalStamp}>PROVISÓRIO</span>
              <span>
                {(interpolated ? INTERPOLATED_MARK : PROVISIONAL_MARK).slice('PROVISÓRIO'.length)}
              </span>
            </strong>
            <span>
              {' '}
              {interpolated
                ? 'Capacidade interpolada linearmente entre pontos da tabela; não é valor definitivo.'
                : 'Capacidade tirada de um ponto da tabela, do lado seguro; não é valor definitivo.'}
            </span>
          </p>

          {transport !== null && result !== null && error === null && inputProblem === null && (
            <p className={styles.meta}>Recebida por {TRANSPORT_LABEL[transport]}.</p>
          )}
        </div>
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
  if (result.workingRadiusM !== null) {
    rows.push({ label: 'Raio de trabalho (backend)', value: meters(result.workingRadiusM) })
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
          ? 'conservadora provisória (ADR-015)'
          : capacity.strategy === LINEAR_INTERPOLATION_STRATEGY
            ? 'interpolação linear provisória (ADR-030)'
            : (capacity.strategy ?? 'não informada pelo backend'),
    })
  }
  if (result.loadChartId !== null || result.loadChartVersion !== null) {
    rows.push({
      label: 'Tabela de carga',
      value: `${result.loadChartId ?? '—'} (versão ${result.loadChartVersion ?? '—'})`,
    })
  }

  return (
    <>
      {result.kind === 'NOT_EVALUABLE' && (
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
              <li key={`${reason.code}-${index}`}>
                <code>{reason.code}</code>
                {reason.category !== null && <span> ({reason.category})</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {rows.length > 0 && (
        <details className={styles.details}>
          <summary>Detalhes da consulta</summary>
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
                ? 'A cor é o nível devolvido pelo backend: o peso comparado (carga + gancho) contra a capacidade efetiva do modelo (RN-011).'
                : 'A cor só compara o peso comparado (carga + gancho) com a capacidade: não há níveis de alerta definidos (PEND-004).'}
            </p>
          )}
        </details>
      )}
    </>
  )
}
