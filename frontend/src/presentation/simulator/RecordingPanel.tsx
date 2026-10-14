import { Circle, Pause, Play, Save, Square, Trash2, X } from 'lucide-react'
import { type FormEvent, useId, useState } from 'react'

import type { SimulationRecordingController } from '../../app/simulator/useSimulationRecording'
import { formatClock } from '../../application/recording/playback'
import { PLAYBACK_SPEEDS, type PlaybackSpeed } from '../../application/recording/recording'
import { ReviewRecordingButton } from '../ai'
import { Button, cx } from '../ui'
import styles from './RecordingPanel.module.css'

export interface RecordingPanelProps {
  readonly controller: SimulationRecordingController
  /** Quem pode apagar uma gravação: o autor ou um admin (ADR-016). */
  readonly canDelete: (authorUserId: string) => boolean
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

/**
 * Gravação e reprodução de simulações (TASK-057; ADR-027), numa faixa abaixo da barra de vistas: botões
 * Gravar, Parar e Salvar (com nome), a lista de gravações salvas e o player (reproduzir, pausar,
 * velocidade e linha do tempo com marcadores de alerta e colisão). Durante a reprodução o simulador
 * fica travado e mostra os quadros gravados.
 */
export function RecordingPanel({ controller, canDelete }: RecordingPanelProps) {
  const { recorder, list, player } = controller
  const [listOpen, setListOpen] = useState(false)
  const [name, setName] = useState('')
  const nameId = useId()
  const listId = useId()
  const playing = player.recording !== null

  const toggleList = () => {
    const next = !listOpen
    setListOpen(next)
    if (next && list.status === 'idle') void list.refresh()
  }

  const submitSave = async (event: FormEvent) => {
    event.preventDefault()
    if (await recorder.save(name)) setName('')
  }

  return (
    <section className={styles.panel} aria-label="Gravação de simulações">
      <div className={styles.bar}>
        <span className={styles.caption} aria-hidden="true">
          Gravação
        </span>
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
        <button
          type="button"
          className={styles.toggle}
          aria-expanded={listOpen}
          aria-controls={listId}
          onClick={toggleList}
        >
          Gravações salvas
        </button>
      </div>

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
          <Button size="sm" variant="ghost" onClick={recorder.discard} disabled={recorder.saving}>
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

      {listOpen && (
        <div id={listId} className={styles.list}>
          {list.status === 'loading' && <p className={styles.note}>Carregando gravações…</p>}
          {list.error !== null && (
            <p className={styles.error} role="alert">
              {list.error}
            </p>
          )}
          {list.status === 'ready' && list.items.length === 0 && (
            <p className={styles.note}>Nenhuma gravação salva ainda.</p>
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
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {playing && player.recording !== null && (
        <div className={styles.player} role="group" aria-label="Reprodução">
          <div className={styles.playerRow}>
            <strong className={styles.playerTitle}>{player.recording.name}</strong>
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
              {formatClock(player.positionMs, true)} / {formatClock(player.recording.durationMs)}
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
              max={player.recording.durationMs}
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
                    left: `${(marker.tMs / Math.max(1, player.recording?.durationMs ?? 1)) * 100}%`,
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
      )}
    </section>
  )
}
