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
  /** Tabela cuja matriz está na prévia (destaca o botão "Ver matriz"). */
  readonly previewChartId: string | null
  /** Zonas de giro da configuração (TASK-046), para mostrar a zona de cada versão pelo nome. */
  readonly zones?: readonly RotationZone[]
  onPreview(chartId: string): void
  onActivate(version: LoadChartSummary): void
  onRetry(): void
}

/**
 * Linha do tempo das versões da configuração (RN-005), na ordem do backend (versão da maior para a
 * menor; não há data de importação), com a ativa (`active_chart_id`) em destaque. A lista vem de
 * `GET /configurations/{id}/load-charts` (TASK-044).
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
      title="Versões"
      subtitle="Da maior versão para a menor"
      stamp="REV."
      actions={
        <>
          {count > 0 && <Badge tone="neutral">{count}</Badge>}
          <Button
            variant="ghost"
            size="sm"
            icon={<RefreshCw size={14} />}
            onClick={onRetry}
            disabled={state.status === 'loading' || state.status === 'idle'}
            aria-label="Atualizar as versões"
          />
        </>
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
      <EmptyState
        compact
        tone="neutral"
        icon={<History size={22} />}
        title="Escolha uma configuração"
        description="As versões aparecem aqui depois de escolher fabricante, guindaste e configuração."
      />
    )
  }
  if (state.status === 'loading' && state.versions.length === 0) {
    return (
      <div className={styles.timelineSkeleton} aria-busy="true">
        <span className="visually-hidden">Carregando as versões…</span>
        {[0, 1, 2].map((index) => (
          <div key={index} className={styles.timelineSkeletonItem}>
            <Skeleton circle width={14} height={14} />
            <Skeleton width="70%" height={14} />
          </div>
        ))}
      </div>
    )
  }
  if (state.status === 'error') {
    return (
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
    )
  }
  if (state.versions.length === 0) {
    return (
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
    )
  }

  const zoneName = (code: string | null) =>
    code === null ? null : (zones.find((zone) => zone.code === code)?.name ?? code)
  const activeByZone = activeVersionsByZone(state.versions, state.activeCharts)

  return (
    <>
      {zones.length > 0 && (
        <ul className={styles.zoneBadgeRow} aria-label="Tabela ativa por zona">
          {zones.map((zone) => {
            const active = activeByZone.get(zone.code)
            return (
              <li key={zone.code}>
                <Badge tone={active ? 'ok' : 'warning'} variant="soft">
                  {zone.name}: {active ? active.version : 'nenhuma ativa'}
                </Badge>
              </li>
            )
          })}
        </ul>
      )}
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
              className={cx(styles.timelineItem, active && styles.timelineActive)}
              data-status={version.status}
              aria-current={active ? 'true' : undefined}
            >
              <span className={styles.timelineMarker} aria-hidden="true" />
              <div className={styles.timelineCard}>
                <div className={styles.timelineHead}>
                  <span className={styles.version}>{version.version}</span>
                  <Badge
                    tone={CHART_STATUS_TONE[version.status]}
                    variant={active ? 'solid' : 'soft'}
                  >
                    {CHART_STATUS_LABEL[version.status]}
                  </Badge>
                  {active && (
                    <span className={styles.activeHint}>
                      {zone ? `vale para a avaliação na zona ${zone}` : 'vale para a avaliação'}
                    </span>
                  )}
                </div>
                <dl className={styles.timelineMeta}>
                  {zone && (
                    <div>
                      <dt>Zona</dt>
                      <dd>
                        {zone} <code>{version.rotationZoneCode}</code>
                      </dd>
                    </div>
                  )}
                  <div>
                    <dt>Tabela</dt>
                    <dd>
                      <code>{version.chartId}</code>
                    </dd>
                  </div>
                  <div>
                    <dt>Arquivo</dt>
                    <dd>{version.sourceFileName}</dd>
                  </div>
                  <div>
                    <dt>Pontos</dt>
                    <dd className={styles.mono}>{version.pointCount}</dd>
                  </div>
                </dl>
                <div className={styles.timelineActions}>
                  <Button
                    size="sm"
                    variant={previewing ? 'secondary' : 'ghost'}
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
                </div>
              </div>
            </li>
          )
        })}
      </ol>
    </>
  )
}
