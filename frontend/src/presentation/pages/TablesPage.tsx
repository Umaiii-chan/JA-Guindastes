import { Grid3x3, Lock, Settings2 } from 'lucide-react'
import { useState } from 'react'

import {
  activeVersion,
  activeVersionsByZone,
  firstActiveVersion,
  isActiveChart,
  summaryOf,
  toLoadChartFailure,
} from '../../application/loadChart/chartVersions'
import { createLoadChartCache } from '../../application/loadChart/loadChartCache'
import type {
  LoadChartGateway,
  LoadChartSummary,
  StoredLoadChart,
} from '../../application/loadChart/ports'
import type { CraneConfiguration } from '../../domain/catalog/catalog'
import { Page } from '../layout/Page'
import {
  CatalogSelectionPanel,
  type CatalogSelectionPanelProps,
} from '../panels/CatalogSelectionPanel'
import { ActivationDialog } from '../tables/ActivationDialog'
import { ChartImportPanel } from '../tables/ChartImportPanel'
import { LoadChartMatrix } from '../tables/LoadChartMatrix'
import { StoredChartMatrix } from '../tables/StoredChartMatrix'
import styles from '../tables/tables.module.css'
import { useChartFileCheck } from '../tables/useChartFileCheck'
import { IDLE_CHART_VERSIONS, useChartVersions } from '../tables/useChartVersions'
import { pointsOf, useStoredChart } from '../tables/useStoredChart'
import { VersionTimeline } from '../tables/VersionTimeline'
import { Badge, EmptyState, Notice, Panel, useToast } from '../ui'

export interface TablesPageProps {
  readonly selection: CatalogSelectionPanelProps
  /** Configuração escolhida na seleção compartilhada (Catálogo, Simulador, Tabelas). */
  readonly configuration: CraneConfiguration | null
  readonly gateway: LoadChartGateway
  /** Importar e ativar (ADR-017 § 1: ADMIN edita; Operador só vê). */
  readonly canEdit: boolean
}

/**
 * Tabelas de carga (ADR-017 § 1; TASK-042 e TASK-044): escolha da configuração, importação por
 * arrastar e soltar com validação prévia, prévia da matriz colorida por capacidade, linha do tempo das
 * versões (lida do backend) e ativação confirmada.
 */
export function TablesPage({ selection, configuration, gateway, canEdit }: TablesPageProps) {
  return (
    <Page
      width="wide"
      intro="A tabela importada entra como rascunho (DRAFT) e só vale para a avaliação depois de ativada. Ativar uma versão substitui a ativa da mesma configuração; com zonas de giro, só a da mesma zona."
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
                state={IDLE_CHART_VERSIONS}
                canEdit={false}
                previewChartId={null}
                onPreview={() => undefined}
                onActivate={() => undefined}
                onRetry={() => undefined}
              />
            </div>
          </>
        ) : (
          <ChartWorkspace
            key={configuration.id}
            configuration={configuration}
            gateway={gateway}
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
  canEdit,
}: {
  readonly configuration: CraneConfiguration
  readonly gateway: LoadChartGateway
  readonly canEdit: boolean
}) {
  const toast = useToast()
  const versionsApi = useChartVersions(gateway, configuration.id)
  const [cache] = useState(() => createLoadChartCache(gateway))
  const fileCheck = useChartFileCheck(gateway)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [target, setTarget] = useState<LoadChartSummary | null>(null)
  const [activating, setActivating] = useState(false)

  const { versions, activeChartId, activeCharts } = versionsApi.state
  const zones = configuration.rotationZones ?? []
  const zoneName = (code: string | null) =>
    code === null ? null : (zones.find((zone) => zone.code === code)?.name ?? code)
  // Com zonas (TASK-046), uma ativa por zona; a prévia padrão é a da primeira zona com ativa.
  const active = firstActiveVersion(
    versions,
    activeCharts,
    zones.map((zone) => zone.code),
    activeChartId,
  )
  const isActive = (chartId: string) =>
    activeCharts.length > 0 ? isActiveChart(chartId, activeCharts) : chartId === active?.chartId
  // A ativação compara com a ativa da MESMA zona da versão escolhida.
  const sameZoneActive = target
    ? activeCharts.length > 0
      ? (activeVersionsByZone(versions, activeCharts).get(target.rotationZoneCode) ?? null)
      : activeVersion(versions, activeChartId)
    : null
  const current =
    sameZoneActive && sameZoneActive.chartId !== target?.chartId ? sameZoneActive : null
  const fileState = fileCheck.state
  const filePoints = fileState.status === 'valid' ? fileState.points : null

  // Prévia: o arquivo válido recém-solto, a versão escolhida, a ativa ou a de maior versão.
  const chosenVersion =
    preview?.kind === 'version' ? versions.find((item) => item.chartId === preview.chartId) : null
  const showFile = filePoints !== null && preview?.kind === 'file'
  const shownVersion = showFile ? null : (chosenVersion ?? active ?? versions[0] ?? null)

  // A listagem não traz os pontos: cada tabela mostrada ou comparada é lida uma vez (cache).
  const shownChart = useStoredChart(cache, shownVersion?.chartId ?? null)
  const targetChart = useStoredChart(cache, target?.chartId ?? null)
  const currentChart = useStoredChart(cache, target ? (current?.chartId ?? null) : null)

  const onImported = (chart: StoredLoadChart) => {
    cache.remember(chart)
    versionsApi.reload()
    setPreview({ kind: 'version', chartId: chart.chartId })
  }

  const openActivation = (chart: StoredLoadChart) => {
    cache.remember(chart)
    setTarget(versions.find((item) => item.chartId === chart.chartId) ?? summaryOf(chart))
  }

  const confirmActivation = async () => {
    if (!target) return
    setActivating(true)
    try {
      const result = await gateway.activateChart(target.chartId)
      cache.remember(result.chart)
      const superseded = versions.find((item) => item.chartId === result.supersededChartId)
      const zone = zoneName(result.chart.rotationZoneCode ?? target.rotationZoneCode)
      toast.show({
        tone: 'ok',
        title: zone
          ? `Versão ${result.chart.version} ativada na zona ${zone}`
          : `Versão ${result.chart.version} ativada`,
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
    } finally {
      // Deu certo ou não, a lista do backend é a verdade: relê.
      versionsApi.reload()
      setActivating(false)
      setTarget(null)
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
            zones={zones}
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
                ? `Versão ${shownVersion.version}${zoneName(shownVersion.rotationZoneCode) ? ` · zona ${zoneName(shownVersion.rotationZoneCode)}` : ''} · ${shownVersion.sourceFileName}`
                : 'Lança × raio, colorida pela capacidade'
          }
          icon={<Grid3x3 size={16} />}
          actions={
            showFile ? (
              <Badge tone="info" variant="outline">
                Prévia
              </Badge>
            ) : shownVersion && isActive(shownVersion.chartId) ? (
              <Badge tone="ok">
                {zoneName(shownVersion.rotationZoneCode)
                  ? `Ativa na zona ${zoneName(shownVersion.rotationZoneCode)}`
                  : 'Ativa'}
              </Badge>
            ) : undefined
          }
        >
          {showFile && filePoints ? (
            <LoadChartMatrix
              points={filePoints}
              caption={`Prévia de ${fileState.status === 'valid' ? fileState.file.name : 'arquivo'}`}
            />
          ) : shownVersion ? (
            <StoredChartMatrix state={shownChart} caption={`Versão ${shownVersion.version}`} />
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
          zones={zones}
          onPreview={(chartId) => setPreview({ kind: 'version', chartId })}
          onActivate={setTarget}
          onRetry={versionsApi.reload}
        />
      </div>

      <ActivationDialog
        target={target}
        current={current}
        targetPoints={pointsOf(targetChart)}
        currentPoints={pointsOf(currentChart)}
        zoneName={target ? zoneName(target.rotationZoneCode) : null}
        busy={activating}
        onConfirm={() => void confirmActivation()}
        onCancel={() => setTarget(null)}
      />
    </>
  )
}
