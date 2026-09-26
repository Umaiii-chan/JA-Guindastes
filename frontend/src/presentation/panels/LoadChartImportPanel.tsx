import { type FormEvent, useId, useState } from 'react'

import { validateImportForm } from '../../application/loadChart/importForm'
import type {
  LoadChartActivation,
  LoadChartFailure,
  LoadChartGateway,
  LoadChartImportOutcome,
  StoredLoadChart,
} from '../../application/loadChart/ports'

function formatNumber(value: number, fractionDigits: number): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  })
}

function toFailure(error: unknown): LoadChartFailure {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    typeof error.code === 'string' &&
    typeof error.message === 'string'
  ) {
    const httpStatus =
      'httpStatus' in error && typeof error.httpStatus === 'number' ? error.httpStatus : null
    return { code: error.code, httpStatus, message: error.message }
  }
  return { code: 'UNEXPECTED_ERROR', httpStatus: null, message: 'Erro inesperado.' }
}

export type LoadChartImportBusy = 'importing' | 'activating' | null

export interface LoadChartImportReportProps {
  /** Problemas do formulário, antes de enviar. */
  readonly formProblems: readonly string[]
  readonly outcome: LoadChartImportOutcome | null
  readonly activation: LoadChartActivation | null
  readonly error: LoadChartFailure | null
  readonly busy: LoadChartImportBusy
  onActivate?(): void
}

function ChartSummary({ chart }: { readonly chart: StoredLoadChart }) {
  return (
    <dl className="evaluation-panel__values">
      <div className="evaluation-panel__row">
        <dt>Tabela</dt>
        <dd>{chart.chartId}</dd>
      </div>
      <div className="evaluation-panel__row">
        <dt>Versão</dt>
        <dd>{chart.version}</dd>
      </div>
      <div className="evaluation-panel__row">
        <dt>Configuração</dt>
        <dd>{chart.configurationId}</dd>
      </div>
      <div className="evaluation-panel__row">
        <dt>Status</dt>
        <dd>{chart.status}</dd>
      </div>
      <div className="evaluation-panel__row">
        <dt>Arquivo</dt>
        <dd>{chart.sourceFileName}</dd>
      </div>
    </dl>
  )
}

function ChartPoints({ chart }: { readonly chart: StoredLoadChart }) {
  return (
    <table className="evaluation-panel__reasons">
      <caption>{chart.points.length} ponto(s) importado(s)</caption>
      <thead>
        <tr>
          <th scope="col">Lança (m)</th>
          <th scope="col">Raio (m)</th>
          <th scope="col">Capacidade (kg)</th>
        </tr>
      </thead>
      <tbody>
        {chart.points.map((point, index) => (
          <tr key={index}>
            <td>{formatNumber(point.boomLengthM, 2)}</td>
            <td>{formatNumber(point.workingRadiusM, 2)}</td>
            <td>{formatNumber(point.maxCapacityKg, 0)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** Resultado da importação e da ativação (sem estado; testável com renderização estática). */
export function LoadChartImportReport({
  formProblems,
  outcome,
  activation,
  error,
  busy,
  onActivate,
}: LoadChartImportReportProps) {
  return (
    <div aria-live="polite">
      {formProblems.length > 0 && (
        <ul className="evaluation-panel__error" role="alert">
          {formProblems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      )}
      {busy === 'importing' && <p className="evaluation-panel__pending">Enviando a tabela…</p>}
      {busy === 'activating' && <p className="evaluation-panel__pending">Ativando a tabela…</p>}
      {error && (
        <p className="evaluation-panel__error" role="alert">
          {error.message}
        </p>
      )}

      {outcome?.kind === 'INVALID' && (
        <div className="evaluation-panel__reasons">
          <p className="evaluation-panel__result evaluation-panel__result--not-evaluable">
            Importação recusada: status INVALID, nada foi gravado.
          </p>
          <table>
            <caption>Relatório de inconsistências ({outcome.issues.length})</caption>
            <thead>
              <tr>
                <th scope="col">Linha</th>
                <th scope="col">Coluna</th>
                <th scope="col">Código</th>
                <th scope="col">Mensagem</th>
              </tr>
            </thead>
            <tbody>
              {outcome.issues.map((issue, index) => (
                <tr key={index}>
                  <td>{issue.line ?? '—'}</td>
                  <td>{issue.column ?? '—'}</td>
                  <td>{issue.code}</td>
                  <td>{issue.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {outcome?.kind === 'IMPORTED' && activation === null && (
        <div>
          <p className="evaluation-panel__result">
            Tabela importada com status {outcome.chart.status}.
          </p>
          <ChartSummary chart={outcome.chart} />
          <button type="button" onClick={onActivate} disabled={busy !== null}>
            Ativar
          </button>
          <ChartPoints chart={outcome.chart} />
        </div>
      )}

      {activation && (
        <div>
          <p className="evaluation-panel__result">
            Tabela ativada: status {activation.chart.status}.
          </p>
          <ChartSummary chart={activation.chart} />
          <p className="evaluation-panel__meta">
            {activation.supersededChartId === null
              ? 'Não havia tabela ativa nesta configuração: nenhuma foi substituída.'
              : `Tabela substituída: ${activation.supersededChartId} — agora SUPERSEDED.`}
          </p>
        </div>
      )}
    </div>
  )
}

export interface LoadChartImportPanelProps {
  readonly gateway: LoadChartGateway
  /**
   * Configuração selecionada na tela. Quando ausente, o painel mostra um campo próprio (até a tela
   * de catálogo, TASK-033, fornecer a seleção).
   */
  readonly configurationId?: string
}

/** Importação de tabela de carga (CSV/XLSX) e ativação (TASK-034; contrato da TASK-031). */
export function LoadChartImportPanel({ gateway, configurationId }: LoadChartImportPanelProps) {
  const idPrefix = useId()
  const [file, setFile] = useState<File | null>(null)
  const [ownConfigurationId, setOwnConfigurationId] = useState('')
  const [chartId, setChartId] = useState('')
  const [version, setVersion] = useState('')
  const [formProblems, setFormProblems] = useState<readonly string[]>([])
  const [outcome, setOutcome] = useState<LoadChartImportOutcome | null>(null)
  const [activation, setActivation] = useState<LoadChartActivation | null>(null)
  const [error, setError] = useState<LoadChartFailure | null>(null)
  const [busy, setBusy] = useState<LoadChartImportBusy>(null)

  const effectiveConfigurationId = configurationId ?? ownConfigurationId

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy !== null) return
    const { request, problems } = validateImportForm({
      file,
      configurationId: effectiveConfigurationId,
      chartId,
      version,
    })
    setFormProblems(problems)
    setError(null)
    setOutcome(null)
    setActivation(null)
    if (request === null) return
    setBusy('importing')
    try {
      setOutcome(await gateway.importChart(request))
    } catch (caught) {
      setError(toFailure(caught))
    } finally {
      setBusy(null)
    }
  }

  const handleActivate = async () => {
    if (busy !== null || outcome?.kind !== 'IMPORTED') return
    setError(null)
    setBusy('activating')
    try {
      setActivation(await gateway.activateChart(outcome.chart.chartId))
    } catch (caught) {
      setError(toFailure(caught))
    } finally {
      setBusy(null)
    }
  }

  const titleId = `${idPrefix}-title`
  return (
    <section className="evaluation-panel" aria-labelledby={titleId}>
      <h2 id={titleId}>Importar tabela de carga</h2>
      <form onSubmit={(event) => void handleSubmit(event)} noValidate>
        <div className="evaluation-input__field">
          <label htmlFor={`${idPrefix}-file`}>Arquivo (CSV ou XLSX)</label>
          <input
            id={`${idPrefix}-file`}
            type="file"
            accept=".csv,.xlsx"
            onChange={(event) => setFile(event.currentTarget.files?.item(0) ?? null)}
          />
        </div>
        {configurationId === undefined ? (
          <div className="evaluation-input__field">
            <label htmlFor={`${idPrefix}-configuration`}>Configuração (configuration_id)</label>
            <input
              id={`${idPrefix}-configuration`}
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={ownConfigurationId}
              onChange={(event) => setOwnConfigurationId(event.currentTarget.value)}
            />
          </div>
        ) : (
          <p className="evaluation-panel__meta">
            Configuração: {configurationId.trim() === '' ? '(nenhuma informada)' : configurationId}
          </p>
        )}
        <div className="evaluation-input__field">
          <label htmlFor={`${idPrefix}-chart`}>Id da tabela (chart_id)</label>
          <input
            id={`${idPrefix}-chart`}
            type="text"
            autoComplete="off"
            spellCheck={false}
            value={chartId}
            onChange={(event) => setChartId(event.currentTarget.value)}
          />
        </div>
        <div className="evaluation-input__field">
          <label htmlFor={`${idPrefix}-version`}>Versão</label>
          <input
            id={`${idPrefix}-version`}
            type="text"
            autoComplete="off"
            spellCheck={false}
            value={version}
            onChange={(event) => setVersion(event.currentTarget.value)}
          />
        </div>
        <button type="submit" disabled={busy !== null}>
          Enviar
        </button>
      </form>
      <LoadChartImportReport
        formProblems={formProblems}
        outcome={outcome}
        activation={activation}
        error={error}
        busy={busy}
        onActivate={() => void handleActivate()}
      />
    </section>
  )
}
