import { Circle, Pause, Play, Save, Square, Trash2, X } from 'lucide-react'
import { type FormEvent, useId, useState } from 'react'

import type { SimulationRecordingController } from '../../app/simulator/useSimulationRecording'
import { formatClock } from '../../application/recording/playback'
import { PLAYBACK_SPEEDS, type PlaybackSpeed } from '../../application/recording/recording'
import { ReviewRecordingButton } from '../ai'
import { Button, cx } from '../ui'
import { useOnSheetOpen } from './layout/sheetContext'
import styles from './RecordingPanel.module.css'

export interface RecordingControlsProps {
  readonly controller: SimulationRecordingController
}

export interface RecordingLibraryProps {
  readonly controller: SimulationRecordingController
  /** Quem pode apagar uma gravação: o autor ou um admin (ADR-016). */
  readonly canDelete: (authorUserId: string) => boolean
}

export interface RecordingPlayerProps {
  readonly controller: SimulationRecordingController
}

function speedLabel(speed: PlaybackSpeed): string {
  return `${String(speed).replace('.', ',')}×`
}

const MARKER_STYLE = {
  alert: 'alert',
  collision: 'collision',
  engage: 'engage',
  release: 'release',
} as const

const MARKER_TEXT = {
  alert: 'Alerta',
  collision: 'Colisão',
  engage: 'Carga engatada',
  release: 'Carga solta',
} as const

const DATE_FORMAT = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

function formatDate(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : DATE_FORMAT.format(date)
}

/*
 * Gravação e reprodução de simulações (TASK-057; ADR-027), em três partes desde a TASK-095: Gravar e
 * Parar (com o nome e o Salvar) na barra de comando, a lista de gravações salvas numa folha e o
 * player com a linha do tempo numa faixa sobre a cena. Durante a reprodução o simulador fica travado
 * e mostra os quadros gravados.
 */

/** Gravar, Parar e Salvar (com nome), na barra de comando. O formulário abre por cima da barra. */
export function RecordingControls({ controller }: RecordingControlsProps) {
  const { recorder } = controller
  const [name, setName] = useState('')
  const nameId = useId()

  const submitSave = async (event: FormEvent) => {
    event.preventDefault()
    if (await recorder.save(name)) setName('')
  }

  return (
    <section className={styles.controls} aria-label="Gravação de simulações">
      {recorder.status !== 'recording' && (
        <Button
          size="sm"
          icon={<Circle size={12} aria-hidden="true" />}
          disabled={!recorder.canStart}
          onClick={recorder.start}
        >
          Gravar
        </Button>
      )}
      {recorder.status === 'recording' && (
        <Button
          size="sm"
          variant="danger"
          icon={<Square size={12} aria-hidden="true" />}
          onClick={recorder.stop}
        >
          Parar
        </Button>
      )}
      {recorder.status !== 'idle' && (
        <span
          className={cx(styles.status, recorder.status === 'recording' && styles.live)}
          role="status"
        >
          {recorder.status === 'recording' ? 'Gravando' : 'Gravação parada'} ·{' '}
          {formatClock(recorder.elapsedMs)} · {recorder.frameCount} quadros
        </span>
      )}

      {(recorder.draft !== null || recorder.error !== null) && (
        <div className={styles.savePopover}>
          {recorder.draft !== null && (
            <form className={styles.saveForm} onSubmit={(event) => void submitSave(event)}>
              <label htmlFor={nameId}>Nome da gravação</label>
              <input
                id={nameId}
                className={styles.nameInput}
                value={name}
                maxLength={120}
                onChange={(event) => setName(event.target.value)}
              />
              <Button
                type="submit"
                size="sm"
                variant="primary"
                icon={<Save size={12} aria-hidden="true" />}
                loading={recorder.saving}
              >
                Salvar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={recorder.discard}
                disabled={recorder.saving}
              >
                Descartar
              </Button>
              {recorder.draft.stoppedBy !== 'user' && (
                <span className={styles.note} role="status">
                  {recorder.draft.stoppedBy === 'duration-limit'
                    ? 'A gravação parou no limite de 10 minutos.'
                    : 'A gravação parou no limite de 5 MB.'}
                </span>
              )}
            </form>
          )}
          {recorder.error !== null && (
            <p className={styles.error} role="alert">
              {recorder.error}
            </p>
          )}
        </div>
      )}
    </section>
  )
}

/**
 * Lista das gravações salvas (folha "Gravações salvas"): reproduzir, revisar com a IA e apagar. A
 * lista é carregada quando a folha abre pela primeira vez (ou de novo, depois de um erro).
 */
export function RecordingLibrary({ controller, canDelete }: RecordingLibraryProps) {
  const { recorder, list } = controller
  useOnSheetOpen(() => {
    if (list.status === 'idle' || list.status === 'error') void list.refresh()
  })

  return (
    <div className={styles.library}>
      {list.status === 'loading' && <p className={styles.note}>Carregando gravações…</p>}
      {list.error !== null && (
        <p className={styles.error} role="alert">
          {list.error}
        </p>
      )}
      {list.status === 'ready' && list.items.length === 0 && (
        <p className={styles.note}>
          Nenhuma gravação salva ainda. Use “Gravar”, na barra de comando, para gravar a simulação.
        </p>
      )}
      {list.items.length > 0 && (
        <ul className={styles.items}>
          {list.items.map((item) => (
            <li key={item.id} className={styles.item}>
              <span className={styles.itemName}>{item.name}</span>
              <span className={styles.itemMeta}>
                {item.authorDisplayName} · {formatDate(item.createdAt)} ·{' '}
                {formatClock(item.durationMs)}
              </span>
              <span className={styles.itemActions}>
                <Button
                  size="sm"
                  icon={<Play size={12} aria-hidden="true" />}
                  disabled={recorder.status === 'recording'}
                  aria-label={`Reproduzir ${item.name}`}
                  onClick={() => void list.open(item.id)}
                >
                  Reproduzir
                </Button>
                <ReviewRecordingButton recordingId={item.id} recordingName={item.name} />
                {canDelete(item.authorUserId) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Trash2 size={12} aria-hidden="true" />}
                    aria-label={`Apagar ${item.name}`}
                    onClick={() => {
                      if (window.confirm(`Apagar a gravação "${item.name}"?`)) {
                        void list.remove(item.id)
                      }
                    }}
                  >
                    Apagar
                  </Button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Player da gravação aberta: reproduzir, pausar, velocidade e a linha do tempo com marcadores. */
export function RecordingPlayer({ controller }: RecordingPlayerProps) {
  const { player } = controller
  if (player.recording === null) return null
  const recording = player.recording
  return (
    <div className={styles.player} role="group" aria-label="Reprodução">
      <div className={styles.playerRow}>
        <strong className={styles.playerTitle}>{recording.name}</strong>
        <Button
          size="sm"
          variant="primary"
          icon={
            player.playing ? (
              <Pause size={12} aria-hidden="true" />
            ) : (
              <Play size={12} aria-hidden="true" />
            )
          }
          onClick={player.playing ? player.pause : player.play}
        >
          {player.playing ? 'Pausar' : 'Reproduzir'}
        </Button>
        <label className={styles.speed}>
          Velocidade
          <select
            value={player.speed}
            onChange={(event) => player.setSpeed(Number(event.target.value) as PlaybackSpeed)}
          >
            {PLAYBACK_SPEEDS.map((speed) => (
              <option key={speed} value={speed}>
                {speedLabel(speed)}
              </option>
            ))}
          </select>
        </label>
        <span className={styles.clock}>
          {formatClock(player.positionMs, true)} / {formatClock(recording.durationMs)}
        </span>
        <Button
          size="sm"
          variant="ghost"
          icon={<X size={12} aria-hidden="true" />}
          onClick={player.close}
        >
          Fechar
        </Button>
      </div>
      <div className={styles.timeline}>
        <input
          type="range"
          className={styles.range}
          aria-label="Linha do tempo"
          min={0}
          max={recording.durationMs}
          step={50}
          value={player.positionMs}
          onChange={(event) => player.seek(Number(event.target.value))}
        />
        <div className={styles.markers}>
          {player.markers.map((marker, index) => (
            <button
              key={`${marker.kind}-${marker.tMs}-${index}`}
              type="button"
              className={cx(styles.marker, styles[MARKER_STYLE[marker.kind]])}
              style={{
                left: `${(marker.tMs / Math.max(1, recording.durationMs)) * 100}%`,
              }}
              data-kind={marker.kind}
              title={`${MARKER_TEXT[marker.kind]} em ${formatClock(marker.tMs, true)}: ${marker.label}`}
              aria-label={`${MARKER_TEXT[marker.kind]} em ${formatClock(marker.tMs, true)}`}
              onClick={() => player.seek(marker.tMs)}
            />
          ))}
        </div>
      </div>
      <p className={styles.note}>
        Reprodução: os controles ficam travados e o resultado mostrado é o gravado (não é
        reavaliado).
      </p>
    </div>
  )
}
