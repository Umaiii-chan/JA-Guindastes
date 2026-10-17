import type { ReactNode } from 'react'

import type { ConnectionStatus } from '../../domain/evaluation/evaluation'
import { cx, Spinner, StatusPill, type Tone } from '../ui'
import styles from './ConnectionStatusBar.module.css'

export interface ConnectionStatusBarProps {
  readonly connectionStatus: ConnectionStatus
  /** Por onde veio o último resultado mostrado. */
  readonly transport: 'websocket' | 'rest' | null
  readonly pending: boolean
  /** O backend está demorando para responder (TASK-050). */
  readonly slow?: boolean
  /** Ações de câmera (predefinições da TASK-041). Sem elas, mostra a dica de mouse. */
  readonly cameraActions?: ReactNode
  /**
   * Barra de vistas sobre a cena (TASK-095): a conexão vira um ponto de cor, com o texto para
   * leitores de tela e na dica ao passar o mouse.
   */
  readonly compact?: boolean
}

const CONNECTION: Record<ConnectionStatus, { tone: Tone; label: string; pulse: boolean }> = {
  idle: { tone: 'neutral', label: 'Conexão não iniciada', pulse: false },
  connecting: { tone: 'info', label: 'Conectando ao servidor…', pulse: true },
  connected: { tone: 'ok', label: 'Tempo real', pulse: false },
  reconnecting: { tone: 'warning', label: 'Reconectando…', pulse: true },
  closed: { tone: 'neutral', label: 'Conexão fechada', pulse: false },
  rest: { tone: 'ok', label: 'Conectado', pulse: false },
}

/**
 * Barra do quadro da cena (ADR-017 § 2, com o visual do ADR-019): o nome da vista, a conexão
 * WebSocket/REST, a atualização e as vistas da câmera, em células separadas por filetes, como a faixa
 * de título de um desenho.
 */
export function ConnectionStatusBar({
  connectionStatus,
  pending,
  slow = false,
  cameraActions,
  compact = false,
}: ConnectionStatusBarProps) {
  const connection = CONNECTION[connectionStatus]
  const pendingText = slow ? 'aguardando o servidor…' : 'atualizando…'
  return (
    <div
      className={cx(styles.bar, compact && styles.compact)}
      role="group"
      aria-label="Status da conexão e câmera"
    >
      <span className={cx(styles.cell, compact && styles.dotCell)} title={connection.label}>
        <StatusPill
          className={compact ? styles.dotOnly : undefined}
          tone={connection.tone}
          pulse={connection.pulse}
          size="sm"
          live
        >
          {connection.label}
        </StatusPill>
      </span>
      {pending && (
        <span className={cx(styles.cell, styles.pending)} title={pendingText}>
          <Spinner size={10} />{' '}
          <span className={compact ? 'visually-hidden' : undefined}>{pendingText}</span>
        </span>
      )}
      <span className={styles.spacer} aria-hidden="true" />
      {cameraActions ?? (
        <span className={cx(styles.cell, styles.hint)}>
          Arraste para girar · role para aproximar
        </span>
      )}
    </div>
  )
}
