import { Eye, History, Power, RefreshCw, TriangleAlert } from 'lucide-react'

import {
  activeVersionsByZone,
  isActivatable,
  isActiveChart,
} from '../../application/loadChart/chartVersions'
import type { LoadChartSummary } from '../../application/loadChart/ports'
import type { RotationZone } from '../../domain/catalog/catalog'
import { Badge, Button, cx, EmptyState, Panel, Skeleton } from '../ui'
import { CHART_STATUS_LABEL, CHART_STATUS_TONE } from './chartStatus'
import styles from './tables.module.css'
import type { ChartVersionsState } from './useChartVersions'

export interface VersionTimelineProps {
  readonly state: ChartVersionsState
  readonly canEdit: boolean
  /** Tabela cuja matriz está na prévia (marcada como a linha escolhida). */
  readonly previewChartId: string | null
  /** Zonas de giro da configuração (TASK-046), para mostrar a zona de cada versão pelo nome. */
  readonly zones?: readonly RotationZone[]
  onPreview(chartId: string): void
  onActivate(version: LoadChartSummary): void
  onRetry(): void
}

/**
 * Versões da configuração (RN-005) como o registro de revisões de uma prancha (ADR-019): uma linha por
 * versão, na ordem do backend (da maior para a menor), com as colunas REV., ZONA, STATUS, ARQUIVO e
 * PTS. A ativa (`active_charts`/`active_chart_id`) leva o carimbo "EM VIGOR"; a linha cuja matriz está
 * na prévia leva o traço laranja. Não há coluna de data: a listagem do backend
 * (`GET /configurations/{id}/load-charts`, TASK-044) não informa quando cada versão foi importada.
 */
export function VersionTimeline({
  state,
  canEdit,
  previewChartId,
  zones = [],
  onPreview,
  onActivate,
  onRetry,
}: VersionTimelineProps) {
  const count = state.versions.length
  return (
    <Panel
      title="Registro de revisões"
      subtitle={
        count > 0
          ? `${count} ${count === 1 ? 'versão' : 'versões'}, da maior para a menor`
          : 'Da maior versão para a menor'
      }
      stamp="REV."
      flush
      actions={
        <Button
          variant="ghost"
          size="sm"
          icon={<RefreshCw size={14} />}
          onClick={onRetry}
          disabled={state.status === 'loading' || state.status === 'idle'}
          aria-label="Atualizar as versões"
        />
      }
    >
      <TimelineBody
        state={state}
        canEdit={canEdit}
        previewChartId={previewChartId}
        zones={zones}
        onPreview={onPreview}
        onActivate={onActivate}
        onRetry={onRetry}
      />
    </Panel>
  )
}

function TimelineBody({
  state,
  canEdit,
  previewChartId,
  zones = [],
  onPreview,
  onActivate,
  onRetry,
}: VersionTimelineProps) {
  if (state.status === 'idle') {
    return (
      <div className={styles.registerEmpty}>
        <EmptyState
          compact
          tone="neutral"
          icon={<History size={22} />}
          title="Escolha uma configuração"
          description="As versões aparecem aqui depois de escolher fabricante, guindaste e configuração."
        />
      </div>
    )
  }
  if (state.status === 'loading' && state.versions.length === 0) {
    return (
      <div className={styles.timelineSkeleton} aria-busy="true">
        <span className="visually-hidden">Carregando as versões…</span>
        {[0, 1, 2].map((index) => (
          <div key={index} className={styles.timelineSkeletonItem}>
            <Skeleton width={36} height={14} />
            <Skeleton width="70%" height={14} />
          </div>
        ))}
      </div>
    )
  }
  if (state.status === 'error') {
    return (
      <div className={styles.registerEmpty}>
        <EmptyState
          compact
          tone="danger"
          role="alert"
          icon={<TriangleAlert size={22} />}
          title="Não foi possível ler as versões"
          description={state.error}
          action={
            <Button size="sm" icon={<RefreshCw size={14} />} onClick={onRetry}>
              Tentar de novo
            </Button>
          }
        />
      </div>
    )
  }
  if (state.versions.length === 0) {
    return (
      <div className={styles.registerEmpty}>
        <EmptyState
          compact
          tone="neutral"
          icon={<History size={22} />}
          title="Nenhuma versão importada"
          description={
            canEdit
              ? 'Esta configuração ainda não tem tabela de carga. Importe a primeira ao lado.'
              : 'Esta configuração ainda não tem tabela de carga.'
          }
        />
      </div>
    )
  }

  const hasZones = zones.length > 0
  const zoneName = (code: string | null) =>
    code === null ? null : (zones.find((zone) => zone.code === code)?.name ?? code)
  const activeByZone = activeVersionsByZone(state.versions, state.activeCharts)

  return (
    <div className={cx(styles.register, hasZones && styles.registerZones)}>
      {hasZones && (
        <div className={styles.inForce}>
          <span className={styles.inForceLabel}>Em vigor por zona</span>
          <ul className={styles.zoneBadgeRow} aria-label="Tabela ativa por zona">
            {zones.map((zone) => {
              const active = activeByZone.get(zone.code)
              return (
                <li key={zone.code} className={cx(!active && styles.inForceMissing)}>
                  <span className={styles.inForceZone}>{zone.name}:</span>{' '}
                  <span className={styles.inForceVersion}>
                    {active ? active.version : 'nenhuma ativa'}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
      {/* Cabeçalho visual das colunas; cada célula da linha repete o rótulo para leitores de tela. */}
      <div className={cx(styles.registerRow, styles.registerHead)} aria-hidden="true">
        <span>Rev.</span>
        {hasZones && <span>Zona</span>}
        <span>Status</span>
        <span>Arquivo · tabela</span>
        <span className={styles.registerNum}>Pts.</span>
        <span />
      </div>
      <ol
        className={styles.timeline}
        aria-label="Linha do tempo das versões"
        aria-busy={state.status === 'loading' || undefined}
      >
        {state.versions.map((version) => {
          // Uma ativa por zona (TASK-046); sem `active_charts`, a indicada ou a de status ACTIVE.
          const active =
            state.activeCharts.length > 0
              ? isActiveChart(version.chartId, state.activeCharts)
              : state.activeChartId !== null
                ? version.chartId === state.activeChartId
                : version.status === 'ACTIVE'
          const zone = zoneName(version.rotationZoneCode)
          const previewing = version.chartId === previewChartId
          return (
            <li
              key={version.chartId}
              className={cx(
                styles.registerRow,
                styles.timelineItem,
                active && styles.timelineActive,
                previewing && styles.timelinePreview,
              )}
              data-status={version.status}
              aria-current={active ? 'true' : undefined}
            >
              <span className={styles.revCell}>
                <span className={styles.version}>{version.version}</span>
                {active && (
                  <span className={styles.seal} aria-hidden="true">
                    Em vigor
                  </span>
                )}
              </span>
              <span className={styles.cellStatus}>
                <Badge tone={CHART_STATUS_TONE[version.status]} variant="outline">
                  {CHART_STATUS_LABEL[version.status]}
                </Badge>
                {active && (
                  <span className={cx(styles.activeHint, 'visually-hidden')}>
                    {zone ? `vale para a avaliação na zona ${zone}` : 'vale para a avaliação'}
                  </span>
                )}
              </span>
              {/* As células vêm de um `dl` sem caixa própria: cada `dd` ocupa a sua coluna. */}
              <dl className={styles.timelineMeta}>
                {zone && (
                  <div>
                    <dt className="visually-hidden">Zona</dt>
                    <dd className={styles.metaZone}>
                      {zone} <code>{version.rotationZoneCode}</code>
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="visually-hidden">Arquivo</dt>
                  <dd className={styles.metaFile} title={version.sourceFileName}>
                    {version.sourceFileName}
                  </dd>
                </div>
                <div>
                  <dt className="visually-hidden">Tabela</dt>
                  <dd className={styles.metaChart}>
                    <code>{version.chartId}</code>
                  </dd>
                </div>
                <div>
                  <dt className="visually-hidden">Pontos</dt>
                  <dd className={styles.metaPoints}>{version.pointCount}</dd>
                </div>
              </dl>
              <span className={styles.timelineActions}>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<Eye size={14} />}
                  aria-pressed={previewing}
                  onClick={() => onPreview(version.chartId)}
                >
                  Ver matriz
                </Button>
                {canEdit && isActivatable(version.status) && (
                  <Button
                    size="sm"
                    variant="primary"
                    icon={<Power size={14} />}
                    onClick={() => onActivate(version)}
                  >
                    Ativar {version.version}
                  </Button>
                )}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
