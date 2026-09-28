import type { ReactNode } from 'react'

import type { ConnectionStatus } from '../../domain/evaluation/evaluation'
import { cx, Spinner, StatusPill, type Tone } from '../ui'
import styles from './ConnectionStatusBar.module.css'

export interface ConnectionStatusBarProps {
  readonly connectionStatus: ConnectionStatus
  /** Por onde veio o último resultado mostrado. */
  readonly transport: 'websocket' | 'rest' | null
  readonly pending: boolean
  /** Ações de câmera (predefinições da TASK-041). Sem elas, mostra a dica de mouse. */
  readonly cameraActions?: ReactNode
}

const CONNECTION: Record<ConnectionStatus, { tone: Tone; label: string; pulse: boolean }> = {
  idle: { tone: 'neutral', label: 'Conexão não iniciada', pulse: false },
  connecting: { tone: 'info', label: 'Conectando ao backend…', pulse: true },
  connected: { tone: 'ok', label: 'Tempo real (WebSocket)', pulse: false },
  reconnecting: { tone: 'warning', label: 'Reconectando — avaliação por REST', pulse: true },
  closed: { tone: 'neutral', label: 'Conexão fechada', pulse: false },
}

/**
 * Barra do quadro da cena (ADR-017 § 2, com o visual do ADR-019): o nome da vista, a conexão
 * WebSocket/REST, a atualização e as vistas da câmera, em células separadas por filetes, como a faixa
 * de título de um desenho.
 */
export function ConnectionStatusBar({
  connectionStatus,
  transport,
  pending,
  cameraActions,
}: ConnectionStatusBarProps) {
  const connection = CONNECTION[connectionStatus]
  return (
    <div className={styles.bar} role="group" aria-label="Status da conexão e câmera">
      <span className={cx(styles.cell, styles.title)} aria-hidden="true">
        Vista 3D
      </span>
      <span className={styles.cell}>
        <StatusPill tone={connection.tone} pulse={connection.pulse} size="sm" live>
          {connection.label}
        </StatusPill>
      </span>
      <span className={cx(styles.cell, styles.transport)}>
        {transport === null
          ? 'Nenhuma avaliação recebida'
          : `Último resultado por ${transport === 'websocket' ? 'WebSocket' : 'REST'}`}
      </span>
      {pending && (
        <span className={cx(styles.cell, styles.pending)}>
          <Spinner size={10} /> atualizando…
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
