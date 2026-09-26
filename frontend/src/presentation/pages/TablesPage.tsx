import { Grid3x3, Lock, Settings2 } from 'lucide-react'
import { useState } from 'react'

import {
  activeVersion,
  failureCode,
  type KnownChartsStore,
  type LoadChartVersion,
  toLoadChartFailure,
} from '../../application/loadChart/chartVersions'
import type { LoadChartGateway, StoredLoadChart } from '../../application/loadChart/ports'
import type { CraneConfiguration } from '../../domain/catalog/catalog'
import { Page } from '../layout/Page'
import {
  CatalogSelectionPanel,
  type CatalogSelectionPanelProps,
} from '../panels/CatalogSelectionPanel'
import { ActivationDialog } from '../tables/ActivationDialog'
import { ChartImportPanel } from '../tables/ChartImportPanel'
import { LoadChartMatrix } from '../tables/LoadChartMatrix'
import styles from '../tables/tables.module.css'
import { useChartFileCheck } from '../tables/useChartFileCheck'
import { useChartVersions } from '../tables/useChartVersions'
import { VersionTimeline } from '../tables/VersionTimeline'
import { Badge, EmptyState, Notice, Panel, useToast } from '../ui'

export interface TablesPageProps {
  readonly selection: CatalogSelectionPanelProps
  /** Configuração escolhida na seleção compartilhada (Catálogo, Simulador, Tabelas). */
  readonly configuration: CraneConfiguration | null
  readonly gateway: LoadChartGateway
  /** Tabelas acompanhadas neste navegador (o backend ainda não lista por configuração). */
  readonly store: KnownChartsStore
  /** Importar e ativar (ADR-017 § 1: ADMIN edita; Operador só vê). Ligado ao perfil pela TASK-040. */
  readonly canEdit: boolean
}

/**
 * Tabelas de carga (ADR-017 § 1; CA-2 e CA-3 da TASK-042): escolha da configuração, importação por
 * arrastar e soltar com validação prévia, prévia da matriz colorida por capacidade, linha do tempo das
 * versões e ativação confirmada.
 */
export function TablesPage({ selection, configuration, gateway, store, canEdit }: TablesPageProps) {
  return (
    <Page
      width="wide"
      intro="A tabela importada entra como rascunho (DRAFT) e só vale para a avaliação depois de ativada. Ativar uma versão substitui a ativa da mesma configuração."
      actions={
        !canEdit && (
          <Badge tone="neutral" icon={<Lock size={12} />}>
            Somente leitura
          </Badge>
        )
      }
    >
      <div className={styles.tablesLayout}>
        <div className={styles.sideColumn}>
          <CatalogSelectionPanel {...selection} />
        </div>
        {configuration === null ? (
          <>
            <div className={styles.mainColumn}>
              <Panel title="Tabela de carga" icon={<Grid3x3 size={16} />}>
                <EmptyState
                  icon={<Settings2 size={24} />}
                  title="Escolha a configuração"
                  description="Cada tabela de carga pertence a uma configuração do guindaste (RN-001). Escolha fabricante, guindaste e configuração ao lado para importar e ver as versões."
                />
              </Panel>
            </div>
            <div className={styles.timelineColumn}>
              <VersionTimeline
                state={{ status: 'idle', versions: [] }}
                canEdit={false}
                previewChartId={null}
                onPreview={() => undefined}
                onActivate={() => undefined}
                onRetry={() => undefined}
                onTrack={() => Promise.resolve(null)}
              />
            </div>
          </>
        ) : (
          <ChartWorkspace
            key={configuration.id}
            configuration={configuration}
            gateway={gateway}
            store={store}
            canEdit={canEdit}
          />
        )}
      </div>
    </Page>
  )
}

type Preview = { readonly kind: 'file' } | { readonly kind: 'version'; readonly chartId: string }

function ChartWorkspace({
  configuration,
  gateway,
  store,
  canEdit,
}: {
  readonly configuration: CraneConfiguration
  readonly gateway: LoadChartGateway
  readonly store: KnownChartsStore
  readonly canEdit: boolean
}) {
  const toast = useToast()
  const versionsApi = useChartVersions(gateway, store, configuration.id)
  const fileCheck = useChartFileCheck(gateway)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [target, setTarget] = useState<LoadChartVersion | null>(null)
  const [activating, setActivating] = useState(false)

  const versions = versionsApi.state.versions
  const active = activeVersion(versions)
  const fileState = fileCheck.state
  const filePoints = fileState.status === 'valid' ? fileState.points : null

  // Prévia: o arquivo válido recém-solto, a versão escolhida, a ativa ou a mais recente.
  const chosenVersion =
    preview?.kind === 'version' ? versions.find((item) => item.chartId === preview.chartId) : null
  const showFile = filePoints !== null && preview?.kind === 'file'
  const shownVersion = showFile ? null : (chosenVersion ?? active ?? versions[0] ?? null)

  const onImported = (chart: StoredLoadChart) => {
    versionsApi.track(chart.chartId)
    setPreview({ kind: 'version', chartId: chart.chartId })
  }

  const openActivation = (chart: StoredLoadChart) => {
    const known = versions.find((item) => item.chartId === chart.chartId)
    setTarget(known ?? { ...chart, trackedAt: new Date().toISOString() })
  }

  const confirmActivation = async () => {
    if (!target) return
    setActivating(true)
    try {
      const result = await gateway.activateChart(target.chartId)
      if (result.supersededChartId) versionsApi.track(result.supersededChartId)
      versionsApi.track(result.chart.chartId)
      const superseded = versions.find((item) => item.chartId === result.supersededChartId)
      toast.show({
        tone: 'ok',
        title: `Versão ${result.chart.version} ativada`,
        description: result.supersededChartId
          ? `A ${superseded?.version ?? result.supersededChartId} passou a Substituída. A capacidade calculada já usa a ${result.chart.version}.`
          : `A capacidade calculada já usa a ${result.chart.version}.`,
      })
      setPreview({ kind: 'version', chartId: result.chart.chartId })
    } catch (error) {
      toast.show({
        tone: 'danger',
        title: `Não foi possível ativar a ${target.version}`,
        description: toLoadChartFailure(error).message,
      })
      versionsApi.reload()
    } finally {
      setActivating(false)
      setTarget(null)
    }
  }

  const trackById = async (chartId: string): Promise<string | null> => {
    try {
      const chart = await gateway.getChart(chartId)
      if (chart.configurationId !== configuration.id) {
        return `A tabela ${chartId} é da configuração ${chart.configurationId}, não desta.`
      }
      versionsApi.track(chart.chartId)
      toast.show({ tone: 'info', title: `Tabela ${chart.version} acompanhada` })
      return null
    } catch (error) {
      if (failureCode(error) === 'LOAD_CHART_NOT_FOUND')
        return `Não existe tabela com o id ${chartId}.`
      return toLoadChartFailure(error).message
    }
  }

  return (
    <>
      <div className={styles.mainColumn}>
        {canEdit ? (
          <ChartImportPanel
            configurationId={configuration.id}
            gateway={gateway}
            fileCheck={{
              ...fileCheck,
              check: async (file, context) => {
                setPreview({ kind: 'file' })
                await fileCheck.check(file, context)
              },
            }}
            versions={versions}
            onImported={onImported}
            onActivateImported={openActivation}
          />
        ) : (
          <Notice tone="neutral" icon={<Lock size={16} />} title="Somente leitura">
            Importar e ativar tabelas exige o perfil Administrador. Você pode consultar as versões e
            a matriz de cada uma.
          </Notice>
        )}

        <Panel
          title="Matriz da tabela"
          subtitle={
            showFile
              ? `Prévia de ${fileState.status === 'valid' ? fileState.file.name : ''} (ainda não gravada)`
              : shownVersion
                ? `Versão ${shownVersion.version} · ${shownVersion.sourceFileName}`
                : 'Lança × raio, colorida pela capacidade'
          }
          icon={<Grid3x3 size={16} />}
          actions={
            showFile ? (
              <Badge tone="info" variant="outline">
                Prévia
              </Badge>
            ) : shownVersion?.status === 'ACTIVE' ? (
              <Badge tone="ok">Ativa</Badge>
            ) : undefined
          }
        >
          {showFile && filePoints ? (
            <LoadChartMatrix
              points={filePoints}
              caption={`Prévia de ${fileState.status === 'valid' ? fileState.file.name : 'arquivo'}`}
            />
          ) : shownVersion ? (
            <LoadChartMatrix
              points={shownVersion.points}
              caption={`Versão ${shownVersion.version}`}
            />
          ) : (
            <EmptyState
              compact
              tone="neutral"
              icon={<Grid3x3 size={22} />}
              title="Nada para mostrar ainda"
              description={
                canEdit
                  ? 'Solte um CSV válido acima para ver a prévia, ou escolha uma versão na linha do tempo.'
                  : 'Escolha uma versão na linha do tempo para ver a matriz.'
              }
            />
          )}
        </Panel>
      </div>

      <div className={styles.timelineColumn}>
        <VersionTimeline
          state={versionsApi.state}
          canEdit={canEdit}
          previewChartId={showFile ? null : (shownVersion?.chartId ?? null)}
          onPreview={(chartId) => setPreview({ kind: 'version', chartId })}
          onActivate={setTarget}
          onRetry={versionsApi.reload}
          onTrack={trackById}
        />
      </div>

      <ActivationDialog
        target={target}
        current={active && active.chartId !== target?.chartId ? active : null}
        busy={activating}
        onConfirm={() => void confirmActivation()}
        onCancel={() => setTarget(null)}
      />
    </>
  )
}
