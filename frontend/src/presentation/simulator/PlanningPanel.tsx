import { createPortal } from 'react-dom'
import { Footprints, MapPin, Play, Square, Wand2 } from 'lucide-react'

import type { CargoPlacement, DeliveryPoint } from '../../domain/environment/environment'
import {
  PLAN_PHASE_LABELS,
  type PlanPhase,
  type PlanRecommendation,
  type PlanningResult,
} from '../../domain/planning/planning'
import { ExplainRecommendationButton } from '../ai'
import { NumberField } from '../panels/NumberField'
import { Badge, Button, Notice, Spinner, type Tone } from '../ui'
import { useRunStripTarget } from './layout/runStrip'
import styles from './PlanningPanel.module.css'

export interface PlanningPlaybackView {
  readonly playing: boolean
  /** 0 a 1. */
  readonly progress: number
  readonly phase: PlanPhase | null
  readonly speed: number
  readonly speeds: readonly number[]
  onSpeed(speed: number): void
  onStart(): void
  onStop(): void
}

export interface PlanningGuideView {
  readonly active: boolean
  readonly finished: boolean
  /** "Passo 2 de 7". */
  readonly counter: string
  readonly title: string
  /** Próxima ação; vazia quando o passo já foi alcançado. */
  readonly actions: readonly string[]
  readonly doneText: string
  readonly reached: boolean
  /** O passo só termina quando a pessoa confirma (soltar a carga). */
  readonly manual: boolean
  onStart(): void
  onExit(): void
  onConfirm(): void
  onSkip(): void
  onPrevious(): void
}

export interface PlanningPanelProps {
  readonly pick: CargoPlacement
  readonly delivery: DeliveryPoint
  onPickChange(changes: Partial<CargoPlacement>): void
  onDeliveryChange(changes: Partial<DeliveryPoint>): void
  /** A carga do passo 2 é válida: sem ela não há o que planejar. */
  readonly loadReady: boolean
  readonly status: 'idle' | 'loading' | 'ready' | 'error'
  readonly error: string | null
  readonly result: PlanningResult | null
  readonly selectedIndex: number
  onSelect(index: number): void
  onPlan(): void
  onApply(): void
  readonly applying: boolean
  /** Por que a trajetória parou ao engatar ou soltar a carga (`null` = nada a avisar). */
  readonly operationMessage?: string | null
  /** Recomendação aplicada na cena (guindaste na posição dela). */
  readonly applied: boolean
  readonly canRun: boolean
  readonly playback: PlanningPlaybackView
  readonly guide: PlanningGuideView
}

const RISK_TONE: Record<string, Tone> = { LOW: 'ok', ATTENTION: 'warning', HIGH: 'danger' }
const RISK_LABEL: Record<string, string> = {
  LOW: 'Risco baixo',
  ATTENTION: 'Atenção',
  HIGH: 'Risco alto',
}

function percent(value: number): string {
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} %`
}

/** Recomendação sem a trajetória (quadros demais): o que a IA precisa para explicar. */
function recommendationForAi(item: PlanRecommendation): Record<string, unknown> {
  return {
    kind: item.kind,
    configurationIds: item.configurationIds,
    placements: item.placements,
    maxLimitUtilizationPercent: item.maxLimitUtilizationPercent,
    tippingRisk: item.tippingRisk,
    valid: item.valid,
    summary: item.summary,
    notes: item.notes,
    details: item.details,
  }
}

function Card({
  item,
  context,
  selected,
  onSelect,
}: {
  readonly item: PlanRecommendation
  readonly context: Record<string, unknown>
  readonly selected: boolean
  onSelect(): void
}) {
  const title =
    item.kind === 'tandem'
      ? `Dois guindastes: ${item.details.map((detail) => detail.label).join(' + ')}`
      : (item.details[0]?.label ?? 'Guindaste')
  return (
    <li>
      <button type="button" className={styles.card} aria-pressed={selected} onClick={onSelect}>
        <span className={styles.cardHead}>
          <span className={styles.cardTitle}>{title}</span>
          <Badge tone={item.valid ? 'ok' : 'danger'} variant="soft">
            {item.valid ? 'Atende' : 'Não atende'}
          </Badge>
        </span>
        <span className={styles.cardSummary}>{item.summary}</span>
        <span className={styles.cardHead}>
          <Badge tone={item.kind === 'tandem' ? 'warning' : 'neutral'} variant="outline">
            {item.kind === 'tandem' ? 'Tandem' : 'Um guindaste'}
          </Badge>
          {item.tippingRisk && (
            <Badge tone={RISK_TONE[item.tippingRisk] ?? 'neutral'} variant="soft">
              {RISK_LABEL[item.tippingRisk]}
            </Badge>
          )}
          <span className={styles.cardSummary}>
            {percent(item.maxLimitUtilizationPercent)} do limite
          </span>
        </span>
      </button>
      <div className={styles.cardActions}>
        <ExplainRecommendationButton recommendation={recommendationForAi(item)} context={context} />
      </div>
    </li>
  )
}

/** Andamento da trajetória: barra, fase e velocidade. */
function TrajectoryRun({
  playback,
  compact = false,
}: {
  readonly playback: PlanningPlaybackView
  readonly compact?: boolean
}) {
  return (
    <>
      <div
        className={styles.progress}
        role="progressbar"
        aria-label="Andamento da trajetória"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(playback.progress * 100)}
        data-compact={compact || undefined}
      >
        <div
          className={styles.progressBar}
          style={{ width: `${Math.round(playback.progress * 100)}%` }}
        />
      </div>
      <div className={styles.playRow}>
        <span>{playback.phase ? PLAN_PHASE_LABELS[playback.phase] : ''}</span>
        <span className={styles.speed} role="group" aria-label="Velocidade">
          {playback.speeds.map((speed) => (
            <Button
              key={speed}
              size="sm"
              variant={speed === playback.speed ? 'primary' : 'ghost'}
              onClick={() => playback.onSpeed(speed)}
            >
              {speed}×
            </Button>
          ))}
        </span>
      </div>
    </>
  )
}

/** Passo a passo: a próxima ação em destaque e os botões. */
function GuideCard({ guide }: { readonly guide: PlanningGuideView }) {
  return (
    <div className={styles.guide} role="status" aria-live="polite" aria-label="Passo a passo">
      <span className={styles.guideCount}>
        {guide.counter} · {guide.title}
      </span>
      {guide.finished ? (
        <p className={styles.guideAction} data-done>
          Operação concluída.
        </p>
      ) : guide.reached ? (
        <p className={styles.guideAction} data-done>
          {guide.doneText}
        </p>
      ) : (
        <>
          <p className={styles.guideAction}>{guide.actions[0]}</p>
          {guide.actions.length > 1 && (
            <p className={styles.guideMore}>Depois: {guide.actions.slice(1).join(' · ')}</p>
          )}
        </>
      )}
      <div className={styles.actions}>
        {!guide.finished && guide.manual && guide.reached && (
          <Button size="sm" variant="primary" onClick={guide.onConfirm}>
            Carga solta
          </Button>
        )}
        {!guide.finished && (
          <Button size="sm" variant="ghost" onClick={guide.onPrevious}>
            Voltar
          </Button>
        )}
        {!guide.finished && (
          <Button size="sm" variant="ghost" onClick={guide.onSkip}>
            Pular passo
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={guide.onExit}>
          Sair
        </Button>
      </div>
    </div>
  )
}

/**
 * Faixa compacta sobre a cena (TASK-104): a execução da trajetória (fase, progresso, velocidade e
 * Parar) e o passo a passo (próxima ação e botões), visíveis mesmo com a folha "Planejar" fechada.
 * Só muda onde aparece: o estado e os comandos são os do painel.
 */
function RunStrip({
  playback,
  guide,
}: {
  readonly playback: PlanningPlaybackView
  readonly guide: PlanningGuideView
}) {
  return (
    <div className={styles.strip} role="region" aria-label="Execução do planejamento">
      {playback.playing && (
        <div className={styles.stripRun}>
          <Button size="sm" icon={<Square size={14} />} onClick={playback.onStop}>
            Parar
          </Button>
          <div className={styles.stripBody}>
            <TrajectoryRun playback={playback} compact />
          </div>
        </div>
      )}
      {guide.active && <GuideCard guide={guide} />}
    </div>
  )
}

/**
 * Painel "Planejar operação" (TASK-075): coleta e entrega da carga, as recomendações do backend
 * (guindaste, posição e trajetória), "Aplicar", "Executar trajetória" e o passo a passo. Só
 * apresentação: a capacidade e o risco mostrados vêm do backend (RN-008).
 */
export function PlanningPanel({
  pick,
  delivery,
  onPickChange,
  onDeliveryChange,
  loadReady,
  status,
  error,
  result,
  selectedIndex,
  onSelect,
  onPlan,
  onApply,
  applying,
  operationMessage = null,
  applied,
  canRun,
  playback,
  guide,
}: PlanningPanelProps) {
  const stripTarget = useRunStripTarget()
  const distance = Math.hypot(pick.x - delivery.x, pick.z - delivery.z)
  const recommendations = result?.recommendations ?? []
  const selected = recommendations[selectedIndex]
  const aiContext = {
    coleta: { x: pick.x, z: pick.z, giroGraus: pick.rotationYDeg },
    entrega: {
      x: delivery.x,
      z: delivery.z,
      giroGraus: delivery.rotationYDeg,
      raioM: delivery.radiusM,
    },
    distanciaM: distance,
  }

  return (
    <div className={styles.panel}>
      {stripTarget &&
        (playback.playing || guide.active) &&
        createPortal(<RunStrip playback={playback} guide={guide} />, stripTarget)}
      <div className={styles.section}>
        <span className={styles.heading}>Coleta da carga</span>
        <div className={styles.grid3}>
          <NumberField label="X" unit="m" value={pick.x} onCommit={(x) => onPickChange({ x })} />
          <NumberField label="Z" unit="m" value={pick.z} onCommit={(z) => onPickChange({ z })} />
          <NumberField
            label="Giro"
            unit="°"
            value={pick.rotationYDeg}
            onCommit={(rotationYDeg) => onPickChange({ rotationYDeg })}
          />
        </div>
        <span className={styles.heading}>Entrega da carga</span>
        <div className={styles.grid3}>
          <NumberField
            label="X"
            unit="m"
            value={delivery.x}
            onCommit={(x) => onDeliveryChange({ x })}
          />
          <NumberField
            label="Z"
            unit="m"
            value={delivery.z}
            onCommit={(z) => onDeliveryChange({ z })}
          />
          <NumberField
            label="Giro"
            unit="°"
            value={delivery.rotationYDeg}
            onCommit={(rotationYDeg) => onDeliveryChange({ rotationYDeg })}
          />
        </div>
        <div className={styles.grid3}>
          <NumberField
            label="Raio da área"
            unit="m"
            positive
            value={delivery.radiusM}
            onCommit={(radiusM) => onDeliveryChange({ radiusM })}
          />
        </div>
        <span className={styles.distance}>
          Distância entre a coleta e a entrega:{' '}
          {distance.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} m
        </span>
        {!loadReady && (
          <Notice tone="warning" compact>
            Preencha a carga (passo 2) para planejar.
          </Notice>
        )}
        <div className={styles.actions}>
          <Button
            variant="primary"
            size="sm"
            icon={<Wand2 size={14} />}
            loading={status === 'loading'}
            disabled={!loadReady}
            onClick={onPlan}
          >
            Planejar operação
          </Button>
        </div>
      </div>

      {status === 'error' && error && (
        <Notice tone="danger" role="alert" compact>
          {error}
        </Notice>
      )}

      {status === 'ready' && result && (
        <div className={styles.section}>
          <span className={styles.heading}>Recomendações</span>
          {recommendations.length === 0 && (
            <Notice tone="warning" compact>
              Nenhum guindaste serve para esta operação.
            </Notice>
          )}
          {result.notes.map((note) => (
            <p key={note} className={styles.hint}>
              {note}
            </p>
          ))}
          {recommendations.length > 0 && (
            <ul className={styles.list} aria-label="Recomendações de guindaste">
              {recommendations.map((item, index) => (
                <Card
                  key={`${item.configurationIds.join('+')}-${index}`}
                  item={item}
                  context={aiContext}
                  selected={index === selectedIndex}
                  onSelect={() => onSelect(index)}
                />
              ))}
            </ul>
          )}
        </div>
      )}

      {selected && (
        <div className={styles.section}>
          <span className={styles.heading}>Como fazer</span>
          <ul className={styles.notes}>
            {selected.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
          {selected.kind === 'tandem' && (
            <Notice tone="info" compact>
              “Aplicar” posiciona os dois guindastes. A trajetória move o Guindaste 1; para o
              Guindaste 2 acompanhar, ative o içamento com dois guindastes antes de executar.
            </Notice>
          )}
          <p className={styles.hint}>
            Opção escolhida: {selected.details.map((item) => item.label).join(' + ')}
          </p>
          <div className={styles.actions}>
            <Button
              size="sm"
              icon={<MapPin size={14} />}
              loading={applying}
              disabled={!canRun}
              onClick={onApply}
            >
              Aplicar
            </Button>
            {playback.playing ? (
              !stripTarget && (
                <Button size="sm" icon={<Square size={14} />} onClick={playback.onStop}>
                  Parar
                </Button>
              )
            ) : (
              <Button
                size="sm"
                icon={<Play size={14} />}
                disabled={!canRun || !applied || !selected.valid}
                onClick={playback.onStart}
              >
                Executar trajetória
              </Button>
            )}
            <Button
              size="sm"
              icon={<Footprints size={14} />}
              disabled={!canRun || guide.active}
              onClick={guide.onStart}
            >
              Passo a passo
            </Button>
          </div>
          {!selected.valid && (
            <Notice tone="danger" role="alert" compact>
              Esta opção não atende ({percent(selected.maxLimitUtilizationPercent)} do limite): a
              trajetória fica bloqueada. Escolha uma opção que atenda, use dois guindastes ou reduza
              a carga ou a distância.
            </Notice>
          )}
          {operationMessage && (
            <Notice tone="warning" role="alert" compact>
              {operationMessage}
            </Notice>
          )}
          {!applied && (
            <p className={styles.hint}>
              Use “Aplicar” para posicionar o guindaste antes de executar a trajetória.
            </p>
          )}
          {playback.playing && stripTarget && (
            <p className={styles.hint}>Execução na faixa sobre a cena.</p>
          )}
          {(playback.playing ? !stripTarget : playback.progress > 0) && (
            <TrajectoryRun playback={playback} />
          )}
        </div>
      )}

      {guide.active && !stripTarget && <GuideCard guide={guide} />}

      {status === 'loading' && (
        <span className={styles.hint}>
          <Spinner size={12} /> Calculando as opções…
        </span>
      )}
    </div>
  )
}
