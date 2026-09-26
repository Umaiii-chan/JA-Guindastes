import { CircleCheck, CircleX, FileUp, Power, Upload } from 'lucide-react'
import { type FormEvent, useState } from 'react'

import { validateImportForm } from '../../application/loadChart/importForm'
import type {
  LoadChartActivation,
  LoadChartFailure,
  LoadChartGateway,
  LoadChartImportIssue,
  LoadChartImportOutcome,
  LoadChartPoint,
  StoredLoadChart,
} from '../../application/loadChart/ports'
import { Badge, Button, Field, Input, Notice, Panel, Spinner, Table, type Tone } from '../ui'
import styles from './panels.module.css'

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

const STATUS_TONE: Record<string, Tone> = {
  ACTIVE: 'ok',
  DRAFT: 'info',
  SUPERSEDED: 'neutral',
  INVALID: 'danger',
}

function ChartSummary({ chart }: { readonly chart: StoredLoadChart }) {
  const rows = [
    { label: 'Tabela', value: chart.chartId },
    { label: 'Versão', value: chart.version },
    { label: 'Configuração', value: chart.configurationId },
    { label: 'Arquivo', value: chart.sourceFileName },
  ]
  return (
    <dl className={styles.summaryGrid}>
      {rows.map((row) => (
        <div key={row.label} className={styles.summaryCell}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
      <div className={styles.summaryCell}>
        <dt>Status</dt>
        <dd>
          <Badge tone={STATUS_TONE[chart.status] ?? 'neutral'}>{chart.status}</Badge>
        </dd>
      </div>
    </dl>
  )
}

const POINT_COLUMNS = [
  {
    key: 'boom',
    header: 'Lança (m)',
    numeric: true,
    render: (point: LoadChartPoint) => formatNumber(point.boomLengthM, 2),
  },
  {
    key: 'radius',
    header: 'Raio (m)',
    numeric: true,
    render: (point: LoadChartPoint) => formatNumber(point.workingRadiusM, 2),
  },
  {
    key: 'capacity',
    header: 'Capacidade (kg)',
    numeric: true,
    render: (point: LoadChartPoint) => formatNumber(point.maxCapacityKg, 0),
  },
]

const ISSUE_COLUMNS = [
  { key: 'line', header: 'Linha', render: (issue: LoadChartImportIssue) => issue.line ?? '—' },
  { key: 'column', header: 'Coluna', render: (issue: LoadChartImportIssue) => issue.column ?? '—' },
  {
    key: 'code',
    header: 'Código',
    render: (issue: LoadChartImportIssue) => <code>{issue.code}</code>,
  },
  { key: 'message', header: 'Mensagem', render: (issue: LoadChartImportIssue) => issue.message },
]

function ChartPoints({ chart }: { readonly chart: StoredLoadChart }) {
  return (
    <Table
      caption={`${chart.points.length} ponto(s) importado(s)`}
      showCaption
      columns={POINT_COLUMNS}
      rows={chart.points}
      rowKey={(_, index) => String(index)}
      maxHeight={280}
      dense
    />
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
    <div className={styles.stack} aria-live="polite">
      {formProblems.length > 0 && (
        <Notice tone="danger" role="alert" compact title="Revise o formulário">
          <ul className={styles.bullets}>
            {formProblems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        </Notice>
      )}
      {busy === 'importing' && (
        <p className={styles.busy}>
          <Spinner size={13} /> Enviando a tabela…
        </p>
      )}
      {busy === 'activating' && (
        <p className={styles.busy}>
          <Spinner size={13} /> Ativando a tabela…
        </p>
      )}
      {error && (
        <Notice tone="danger" role="alert" compact>
          {error.message}
        </Notice>
      )}

      {outcome?.kind === 'INVALID' && (
        <div className={styles.stack}>
          <p className={styles.resultLine}>
            <CircleX size={16} aria-hidden="true" className={styles.iconDanger} />
            Importação recusada: status INVALID, nada foi gravado.
          </p>
          <Table
            caption={`Relatório de inconsistências (${outcome.issues.length})`}
            showCaption
            columns={ISSUE_COLUMNS}
            rows={outcome.issues}
            rowKey={(_, index) => String(index)}
            maxHeight={300}
            dense
          />
        </div>
      )}

      {outcome?.kind === 'IMPORTED' && activation === null && (
        <div className={styles.stack}>
          <p className={styles.resultLine}>
            <CircleCheck size={16} aria-hidden="true" className={styles.iconOk} />
            Tabela importada com status {outcome.chart.status}.
          </p>
          <ChartSummary chart={outcome.chart} />
          <div>
            <Button
              variant="primary"
              icon={<Power size={15} />}
              onClick={onActivate}
              disabled={busy !== null}
            >
              Ativar
            </Button>
          </div>
          <ChartPoints chart={outcome.chart} />
        </div>
      )}

      {activation && (
        <div className={styles.stack}>
          <p className={styles.resultLine}>
            <CircleCheck size={16} aria-hidden="true" className={styles.iconOk} />
            Tabela ativada: status {activation.chart.status}.
          </p>
          <ChartSummary chart={activation.chart} />
          <p className={styles.fineprint}>
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

  return (
    <Panel
      title="Importar tabela de carga"
      subtitle="CSV ou XLSX; a tabela entra como rascunho e é ativada depois"
      icon={<FileUp size={16} />}
    >
      <form className={styles.stack} onSubmit={(event) => void handleSubmit(event)} noValidate>
        <Field label="Arquivo (CSV ou XLSX)">
          <Input
            type="file"
            accept=".csv,.xlsx"
            onChange={(event) => setFile(event.currentTarget.files?.item(0) ?? null)}
          />
        </Field>
        {configurationId === undefined ? (
          <Field label="Configuração (configuration_id)">
            <Input
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={ownConfigurationId}
              onChange={(event) => setOwnConfigurationId(event.currentTarget.value)}
            />
          </Field>
        ) : (
          <p className={styles.fineprint}>
            Configuração: {configurationId.trim() === '' ? '(nenhuma informada)' : configurationId}
          </p>
        )}
        <div className={styles.grid2}>
          <Field label="Id da tabela (chart_id)">
            <Input
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={chartId}
              onChange={(event) => setChartId(event.currentTarget.value)}
            />
          </Field>
          <Field label="Versão">
            <Input
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={version}
              onChange={(event) => setVersion(event.currentTarget.value)}
            />
          </Field>
        </div>
        <div className={styles.formActions}>
          <Button
            type="submit"
            variant="primary"
            icon={<Upload size={15} />}
            loading={busy === 'importing'}
            disabled={busy !== null}
          >
            Enviar
          </Button>
        </div>
      </form>
      <LoadChartImportReport
        formProblems={formProblems}
        outcome={outcome}
        activation={activation}
        error={error}
        busy={busy}
        onActivate={() => void handleActivate()}
      />
    </Panel>
  )
}
