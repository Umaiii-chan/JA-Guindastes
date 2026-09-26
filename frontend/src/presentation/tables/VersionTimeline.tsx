import { Eye, History, Power, RefreshCw, Search, TriangleAlert } from 'lucide-react'
import { type FormEvent, useState } from 'react'

import { isActivatable, type LoadChartVersion } from '../../application/loadChart/chartVersions'
import { Badge, Button, cx, EmptyState, Field, Input, Panel, Skeleton } from '../ui'
import { CHART_STATUS_LABEL, CHART_STATUS_TONE } from './chartStatus'
import { formatDateTime } from './format'
import styles from './tables.module.css'
import type { ChartVersionsState } from './useChartVersions'

export interface VersionTimelineProps {
  readonly state: ChartVersionsState
  readonly canEdit: boolean
  /** Tabela cuja matriz está na prévia (destaca o botão "Ver matriz"). */
  readonly previewChartId: string | null
  onPreview(chartId: string): void
  onActivate(version: LoadChartVersion): void
  onRetry(): void
  /** Acompanha uma tabela gravada pelo id; devolve a mensagem de erro, ou `null` se deu certo. */
  onTrack(chartId: string): Promise<string | null>
}

/**
 * Linha do tempo das versões da configuração (RN-005), da mais recente para a mais antiga, com a ativa
 * em destaque. O backend ainda não lista as tabelas de uma configuração: a lista mostra as que este
 * navegador importou, ativou ou acompanhou pelo id (handoffs/TASK-042.md § 8).
 */
export function VersionTimeline({
  state,
  canEdit,
  previewChartId,
  onPreview,
  onActivate,
  onRetry,
  onTrack,
}: VersionTimelineProps) {
  const count = state.versions.length
  return (
    <Panel
      title="Versões"
      subtitle="Da mais recente para a mais antiga"
      icon={<History size={16} />}
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
      footer={state.status !== 'idle' ? <TrackChartForm onTrack={onTrack} /> : undefined}
    >
      <TimelineBody
        state={state}
        canEdit={canEdit}
        previewChartId={previewChartId}
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
  onPreview,
  onActivate,
  onRetry,
}: Omit<VersionTimelineProps, 'onTrack'>) {
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
        title="Nenhuma versão conhecida"
        description="Importe a primeira tabela desta configuração ao lado. Uma tabela importada em outro lugar aparece aqui depois de acompanhada pelo id (o backend ainda não lista as tabelas de uma configuração)."
      />
    )
  }

  return (
    <ol
      className={styles.timeline}
      aria-label="Linha do tempo das versões"
      aria-busy={state.status === 'loading' || undefined}
    >
      {state.versions.map((version) => {
        const active = version.status === 'ACTIVE'
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
                <Badge tone={CHART_STATUS_TONE[version.status]} variant={active ? 'solid' : 'soft'}>
                  {CHART_STATUS_LABEL[version.status]}
                </Badge>
                {active && <span className={styles.activeHint}>vale para a avaliação</span>}
              </div>
              <dl className={styles.timelineMeta}>
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
                  <dd className={styles.mono}>{version.points.length}</dd>
                </div>
                <div>
                  <dt>Acompanhada em</dt>
                  <dd className={styles.mono}>{formatDateTime(version.trackedAt)}</dd>
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
  )
}

function TrackChartForm({ onTrack }: { onTrack(chartId: string): Promise<string | null> }) {
  const [chartId, setChartId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const id = chartId.trim()
    if (id === '') {
      setError('Informe o id da tabela.')
      return
    }
    setBusy(true)
    const problem = await onTrack(id)
    setBusy(false)
    setError(problem)
    if (problem === null) setChartId('')
  }

  return (
    <form className={styles.trackForm} onSubmit={(event) => void submit(event)} noValidate>
      <Field
        label="Acompanhar uma tabela pelo id"
        hint="Para tabelas importadas em outro navegador ou pela API."
        error={error ?? undefined}
      >
        <Input
          type="text"
          autoComplete="off"
          placeholder="ex.: CFG-DEMO-v1"
          value={chartId}
          onChange={(event) => {
            setChartId(event.currentTarget.value)
            if (error) setError(null)
          }}
        />
      </Field>
      <Button type="submit" size="sm" icon={<Search size={14} />} loading={busy}>
        Acompanhar
      </Button>
    </form>
  )
}
