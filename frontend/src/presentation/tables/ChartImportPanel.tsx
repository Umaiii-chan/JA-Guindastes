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
import { formatZoneSector } from '../../application/catalog/rotationZones'
import type { RotationZone } from '../../domain/catalog/catalog'
import { Button, Field, Input, Notice, Panel, Select, useToast } from '../ui'
import { Dropzone, type DropzoneStatus } from '../ui/Dropzone'
import styles from './tables.module.css'
import type { ChartFileCheckApi, ChartFileState } from './useChartFileCheck'

export interface ChartImportPanelProps {
  readonly configurationId: string
  readonly gateway: Pick<LoadChartGateway, 'importChart'>
  readonly fileCheck: ChartFileCheckApi
  /** Versões da configuração (sugestão da próxima e conferência de repetidas). */
  readonly versions: readonly LoadChartSummary[]
  /**
   * Zonas de giro da configuração (TASK-046). Com zonas, a importação pede a zona da tabela; sem
   * elas (padrão), não pede e não manda o campo.
   */
  readonly zones?: readonly RotationZone[]
  onImported(chart: StoredLoadChart): void
  /** Abre a confirmação de ativação da versão recém-importada. */
  onActivateImported(chart: StoredLoadChart): void
}

/** Códigos da zona na importação (TASK-046 § 3) que apontam para o campo da zona. */
const ZONE_REQUIRED_CODE = 'ROTATION_ZONE_REQUIRED'
const UNKNOWN_ZONE_CODE = 'UNKNOWN_ROTATION_ZONE'

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
        description: 'O servidor confere o arquivo sem gravar nada.',
      }
    case 'valid':
      return {
        title: state.file.name,
        description: `Válido: ${state.points.length} pontos, prontos para importar. Confira a prévia da matriz.`,
      }
    case 'unverified':
      return {
        title: state.file.name,
        description: `XLSX de ${formatBytes(state.file.size)}: formato e tamanho conferidos. O conteúdo é validado na importação.`,
      }
    case 'invalid':
      return {
        title: state.file.name,
        description: `${state.issues.length} ${state.issues.length === 1 ? 'problema encontrado' : 'problemas encontrados'}. Veja o relatório de erros.`,
      }
    case 'error':
      return {
        title: state.file.name,
        description: `Não foi possível validar agora: ${state.message} A importação valida de novo.`,
      }
  }
}

/**
 * Importação (CA-2): área de arrastar e soltar com validação prévia, id e versão da tabela e a
 * importação como rascunho (DRAFT). O relatório de erros com linha e coluna fica na coluna larga da
 * página (`ImportIssuesTable`), ao lado desta ordem de importação.
 */
export function ChartImportPanel({
  configurationId,
  gateway,
  fileCheck,
  versions,
  zones = [],
  onImported,
  onActivateImported,
}: ChartImportPanelProps) {
  const toast = useToast()
  const [versionText, setVersionText] = useState<string | null>(null)
  const [chartIdText, setChartIdText] = useState<string | null>(null)
  const [zoneCode, setZoneCode] = useState('')
  /** Recusa da zona pelo backend (422 ROTATION_ZONE_REQUIRED/UNKNOWN_ROTATION_ZONE), no campo. */
  const [zoneBackendError, setZoneBackendError] = useState<string | null>(null)
  const [touched, setTouched] = useState(false)
  const [importing, setImporting] = useState(false)
  const [failure, setFailure] = useState<LoadChartFailure | null>(null)
  const [imported, setImported] = useState<StoredLoadChart | null>(null)

  const hasZones = zones.length > 0
  // A zona escolhida precisa existir na lista atual (ela pode mudar no Catálogo).
  const zone = hasZones ? (zones.find((item) => item.code === zoneCode) ?? null) : null
  const zoneError = !hasZones
    ? null
    : (zoneBackendError ?? (zone === null ? 'Escolha a zona de giro desta tabela.' : null))
  const version = versionText ?? suggestNextVersion(versions)
  const chartId =
    chartIdText ??
    suggestChartId(zone ? `${configurationId}-${zone.code}` : configurationId, version)
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
    if (!('file' in state) || !fileReady || versionError || chartIdError || zoneError) return
    setImporting(true)
    setFailure(null)
    try {
      const outcome = await gateway.importChart({
        file: state.file,
        fileName: state.file.name,
        configurationId,
        chartId: chartId.trim(),
        version: version.trim(),
        ...(zone && { rotationZoneCode: zone.code }),
      })
      if (outcome.kind === 'IMPORTED') {
        toast.show({
          tone: 'ok',
          title: `Versão ${outcome.chart.version} importada`,
          description: zone
            ? `Gravada como rascunho (DRAFT) na zona ${zone.name}. Ative-a para valer na avaliação dessa zona.`
            : 'Gravada como rascunho (DRAFT). Ative-a para valer na avaliação.',
        })
        setImported(outcome.chart)
        setVersionText(null)
        setChartIdText(null)
        // A próxima tabela pede a zona de novo: nada de importar na zona errada por engano.
        setZoneCode('')
        setTouched(false)
        fileCheck.reset()
        onImported(outcome.chart)
      } else {
        fileCheck.showIssues(outcome.issues)
        toast.show({
          tone: 'danger',
          title: 'O servidor recusou a tabela',
          description: `${outcome.issues.length} problemas no arquivo. Nada foi gravado.`,
        })
      }
    } catch (error) {
      const problem = toLoadChartFailure(error)
      if (problem.code === ZONE_REQUIRED_CODE || problem.code === UNKNOWN_ZONE_CODE) {
        setZoneBackendError(problem.message)
      }
      setFailure(problem)
      toast.show({ tone: 'danger', title: 'A importação falhou', description: problem.message })
    } finally {
      setImporting(false)
    }
  }

  return (
    <Panel
      title="Importar tabela"
      subtitle="Arraste o arquivo, confira a prévia e grave como rascunho"
      stamp="IMP."
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
          className={styles.dropzone}
        />

        <form
          className={styles.importForm}
          onSubmit={(event) => void submit(event)}
          noValidate
          aria-label="Dados da importação"
        >
          <div className={styles.importFields}>
            {hasZones && (
              <Field
                label="Zona de giro"
                required
                error={touched || zoneBackendError !== null ? zoneError : undefined}
                hint="Cada zona tem a sua tabela ativa. Ativar esta versão só muda a zona escolhida."
                className={styles.importZoneField}
              >
                <Select
                  value={zone?.code ?? ''}
                  onChange={(event) => {
                    setZoneCode(event.currentTarget.value)
                    setZoneBackendError(null)
                  }}
                >
                  <option value="">Escolha a zona…</option>
                  {zones.map((item) => (
                    <option key={item.code} value={item.code}>
                      {item.name} ({formatZoneSector(item)})
                    </option>
                  ))}
                </Select>
              </Field>
            )}
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
