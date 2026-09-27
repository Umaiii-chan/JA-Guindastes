import { CircleCheck, Power, Upload } from 'lucide-react'
import { type FormEvent, useState } from 'react'

import { formatBytes } from '../../application/loadChart/chartFile'
import {
  suggestChartId,
  suggestNextVersion,
  toLoadChartFailure,
} from '../../application/loadChart/chartVersions'
import type {
  LoadChartFailure,
  LoadChartGateway,
  LoadChartSummary,
  StoredLoadChart,
} from '../../application/loadChart/ports'
import { Button, Field, Input, Notice, Panel, useToast } from '../ui'
import { Dropzone, type DropzoneStatus } from '../ui/Dropzone'
import { ImportIssuesTable } from './ImportIssuesTable'
import styles from './tables.module.css'
import type { ChartFileCheckApi, ChartFileState } from './useChartFileCheck'

export interface ChartImportPanelProps {
  readonly configurationId: string
  readonly gateway: Pick<LoadChartGateway, 'importChart'>
  readonly fileCheck: ChartFileCheckApi
  /** Versões da configuração (sugestão da próxima e conferência de repetidas). */
  readonly versions: readonly LoadChartSummary[]
  onImported(chart: StoredLoadChart): void
  /** Abre a confirmação de ativação da versão recém-importada. */
  onActivateImported(chart: StoredLoadChart): void
}

const ACCEPT =
  '.csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

function dropzoneStatus(state: ChartFileState): DropzoneStatus {
  switch (state.status) {
    case 'idle':
      return 'idle'
    case 'validating':
      return 'validating'
    case 'valid':
    case 'unverified':
      return 'valid'
    case 'rejected':
    case 'invalid':
    case 'error':
      return 'invalid'
  }
}

function dropzoneText(state: ChartFileState): { title?: string; description: string } {
  switch (state.status) {
    case 'idle':
      return {
        description: `CSV ou XLSX, até ${formatBytes(1024 * 1024)}. Colunas boom_length_m, working_radius_m e max_capacity_kg (formato provisório, P-006).`,
      }
    case 'rejected':
      return { title: state.fileName, description: state.problem }
    case 'validating':
      return {
        title: `Validando ${state.file.name}…`,
        description: 'O backend confere o arquivo sem gravar nada.',
      }
    case 'valid':
      return {
        title: state.file.name,
        description: `Válido: ${state.points.length} pontos, prontos para importar. Confira a matriz abaixo.`,
      }
    case 'unverified':
      return {
        title: state.file.name,
        description: `XLSX de ${formatBytes(state.file.size)}: formato e tamanho conferidos. O conteúdo é validado na importação.`,
      }
    case 'invalid':
      return {
        title: state.file.name,
        description: `${state.issues.length} ${state.issues.length === 1 ? 'problema encontrado' : 'problemas encontrados'}. Veja o relatório abaixo.`,
      }
    case 'error':
      return {
        title: state.file.name,
        description: `Não foi possível validar agora: ${state.message} A importação valida de novo.`,
      }
  }
}

/**
 * Importação (CA-2): área de arrastar e soltar com validação prévia, id e versão da tabela, relatório
 * de erros com linha e coluna, e a importação como rascunho (DRAFT).
 */
export function ChartImportPanel({
  configurationId,
  gateway,
  fileCheck,
  versions,
  onImported,
  onActivateImported,
}: ChartImportPanelProps) {
  const toast = useToast()
  const [versionText, setVersionText] = useState<string | null>(null)
  const [chartIdText, setChartIdText] = useState<string | null>(null)
  const [touched, setTouched] = useState(false)
  const [importing, setImporting] = useState(false)
  const [failure, setFailure] = useState<LoadChartFailure | null>(null)
  const [imported, setImported] = useState<StoredLoadChart | null>(null)

  const version = versionText ?? suggestNextVersion(versions)
  const chartId = chartIdText ?? suggestChartId(configurationId, version)
  const versionError =
    version.trim() === ''
      ? 'Obrigatório.'
      : versions.some((item) => item.version.trim().toLowerCase() === version.trim().toLowerCase())
        ? `Já existe a versão ${version.trim()} nesta configuração.`
        : null
  const chartIdError =
    chartId.trim() === ''
      ? 'Obrigatório.'
      : versions.some((item) => item.chartId === chartId.trim())
        ? 'Já existe uma tabela com esse id.'
        : null

  const { state } = fileCheck
  const fileReady =
    state.status === 'valid' || state.status === 'unverified' || state.status === 'error'
  const text = dropzoneText(state)

  const onFiles = (files: readonly File[]) => {
    setFailure(null)
    setImported(null)
    void fileCheck.check(files[0], { configurationId, chartId, version })
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setTouched(true)
    if (!('file' in state) || !fileReady || versionError || chartIdError) return
    setImporting(true)
    setFailure(null)
    try {
      const outcome = await gateway.importChart({
        file: state.file,
        fileName: state.file.name,
        configurationId,
        chartId: chartId.trim(),
        version: version.trim(),
      })
      if (outcome.kind === 'IMPORTED') {
        toast.show({
          tone: 'ok',
          title: `Versão ${outcome.chart.version} importada`,
          description: 'Gravada como rascunho (DRAFT). Ative-a para valer na avaliação.',
        })
        setImported(outcome.chart)
        setVersionText(null)
        setChartIdText(null)
        setTouched(false)
        fileCheck.reset()
        onImported(outcome.chart)
      } else {
        fileCheck.showIssues(outcome.issues)
        toast.show({
          tone: 'danger',
          title: 'O backend recusou a tabela',
          description: `${outcome.issues.length} problemas no arquivo. Nada foi gravado.`,
        })
      }
    } catch (error) {
      const problem = toLoadChartFailure(error)
      setFailure(problem)
      toast.show({ tone: 'danger', title: 'A importação falhou', description: problem.message })
    } finally {
      setImporting(false)
    }
  }

  return (
    <Panel
      title="Importar tabela"
      subtitle="Arraste o arquivo, confira a prévia e importe como rascunho"
      icon={<Upload size={16} />}
    >
      <div className={styles.importBody}>
        <Dropzone
          label="Arquivo da tabela de carga (CSV ou XLSX)"
          accept={ACCEPT}
          status={dropzoneStatus(state)}
          title={text.title}
          description={text.description}
          disabled={importing}
          onFiles={onFiles}
        />

        {state.status === 'invalid' && (
          <ImportIssuesTable issues={state.issues} fileName={state.file.name} />
        )}

        <form
          className={styles.importForm}
          onSubmit={(event) => void submit(event)}
          noValidate
          aria-label="Dados da importação"
        >
          <div className={styles.importFields}>
            <Field
              label="Versão"
              required
              error={touched || versionText !== null ? versionError : undefined}
              hint="Sugerida a partir das versões desta configuração."
            >
              <Input
                type="text"
                autoComplete="off"
                value={version}
                onChange={(event) => setVersionText(event.currentTarget.value)}
              />
            </Field>
            <Field
              label="Id da tabela"
              required
              error={touched || chartIdText !== null ? chartIdError : undefined}
              hint="Único no sistema."
            >
              <Input
                type="text"
                autoComplete="off"
                value={chartId}
                onChange={(event) => setChartIdText(event.currentTarget.value)}
              />
            </Field>
          </div>
          <div className={styles.importActions}>
            <p className={styles.importHint}>
              {fileReady
                ? 'A importação grava a tabela como rascunho; ela ainda não vale para a avaliação.'
                : 'Solte um arquivo válido para liberar a importação.'}
            </p>
            <Button
              type="submit"
              variant="primary"
              icon={<Upload size={15} />}
              loading={importing}
              disabled={!fileReady}
            >
              {importing ? 'Importando…' : 'Importar como rascunho'}
            </Button>
          </div>
        </form>

        {failure && (
          <Notice tone="danger" role="alert" compact title="A importação falhou">
            {failure.message}
          </Notice>
        )}
        {imported && (
          <div className={styles.importedBanner} role="status">
            <CircleCheck size={18} aria-hidden="true" />
            <p>
              <strong>{imported.version}</strong> gravada como rascunho, com{' '}
              {imported.points.length} pontos. Ela só vale para a avaliação depois de ativada.
            </p>
            <Button
              size="sm"
              variant="primary"
              icon={<Power size={14} />}
              onClick={() => onActivateImported(imported)}
            >
              Ativar {imported.version}
            </Button>
          </div>
        )}
      </div>
    </Panel>
  )
}
