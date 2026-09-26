import { useId } from 'react'

import {
  CONSERVATIVE_PROVISIONAL_STRATEGY,
  type ConnectionStatus,
  type EvaluationError,
  type EvaluationResult,
} from '../../domain/evaluation/evaluation'

export type EvaluationTransportLabel = 'websocket' | 'rest'

export interface BackendEvaluationPanelProps {
  readonly connectionStatus: ConnectionStatus
  readonly result: EvaluationResult | null
  readonly error: EvaluationError | null
  /** Há estado mais novo que o mostrado a caminho do backend. */
  readonly pending: boolean
  readonly transport: EvaluationTransportLabel | null
  /** Por que o estado não está sendo enviado (ex.: configuração vazia); `null` se está. */
  readonly inputProblem: string | null
}

export const PROVISIONAL_MARK = 'PROVISÓRIO — consulta conservadora (ADR-015)'

const CONNECTION_LABEL: Record<ConnectionStatus, string> = {
  idle: 'não iniciada',
  connecting: 'conectando…',
  connected: 'conectada (WebSocket)',
  reconnecting: 'reconectando… (avaliação por REST enquanto isso)',
  closed: 'fechada',
}

const TRANSPORT_LABEL: Record<EvaluationTransportLabel, string> = {
  websocket: 'WebSocket',
  rest: 'REST',
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
 * Resultado OFICIAL da avaliação, calculado no backend (RN-008): avaliado ou não avaliável com os
 * motivos (RN-007), capacidade, utilização e o ponto tabelado usado, com a marca da consulta
 * conservadora provisória (ADR-015). Sem nível de alerta (PEND-004).
 */
export function BackendEvaluationPanel({
  connectionStatus,
  result,
  error,
  pending,
  transport,
  inputProblem,
}: BackendEvaluationPanelProps) {
  const titleId = `${useId()}-title`

  return (
    <section className="evaluation-panel" aria-labelledby={titleId} aria-busy={pending}>
      <h2 id={titleId}>
        Avaliação <span className="evaluation-panel__badge">backend</span>
      </h2>
      <p className="evaluation-panel__provisional" role="note">
        <strong>{PROVISIONAL_MARK}</strong>
        <span>
          Capacidade tirada de um ponto da tabela, do lado seguro; não é valor definitivo.
        </span>
      </p>
      <p className="evaluation-panel__meta">
        Conexão em tempo real: <span>{CONNECTION_LABEL[connectionStatus]}</span>
        {pending && <span className="evaluation-panel__pending"> · atualizando…</span>}
      </p>

      {inputProblem !== null ? (
        <p className="evaluation-panel__empty">{inputProblem}</p>
      ) : error !== null ? (
        <p className="evaluation-panel__error" role="alert">
          Não foi possível avaliar: {error.message} <code>{error.code}</code>
        </p>
      ) : result === null ? (
        <p className="evaluation-panel__empty">Aguardando a primeira avaliação do backend…</p>
      ) : (
        <EvaluationResultView result={result} />
      )}

      {transport !== null && result !== null && error === null && inputProblem === null && (
        <p className="evaluation-panel__meta">Recebida por {TRANSPORT_LABEL[transport]}.</p>
      )}
    </section>
  )
}

function EvaluationResultView({ result }: { readonly result: EvaluationResult }) {
  const capacity = result.capacity
  const rows: { label: string; value: string }[] = []
  if (capacity) {
    rows.push({ label: 'Capacidade admissível', value: kilograms(capacity.maximumCapacityKg) })
  }
  if (result.kind === 'EVALUATED') {
    rows.push({ label: 'Utilização', value: `${formatNumber(result.utilizationPercent, 2)} %` })
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
      <p
        className={`evaluation-panel__result evaluation-panel__result--${result.kind === 'EVALUATED' ? 'evaluated' : 'not-evaluable'}`}
      >
        {result.kind === 'EVALUATED' ? 'Avaliado' : 'Não avaliável'}
      </p>
      {result.kind === 'NOT_EVALUABLE' && (
        <div className="evaluation-panel__reasons">
          <p>Motivos:</p>
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
        <dl className="evaluation-panel__values">
          {rows.map((row) => (
            <div className="evaluation-panel__row" key={row.label}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {result.kind === 'EVALUATED' && (
        <p className="evaluation-panel__meta">
          “Avaliado” quer dizer que a tabela cobre o estado; não indica nível de alerta (PEND-004).
        </p>
      )}
    </>
  )
}
