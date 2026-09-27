import { Mouse, Radio } from 'lucide-react'
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

/** Barra de status do simulador (ADR-017 § 2): conexão WebSocket/REST, atualização e câmera. */
export function ConnectionStatusBar({
  connectionStatus,
  transport,
  pending,
  cameraActions,
}: ConnectionStatusBarProps) {
  const connection = CONNECTION[connectionStatus]
  return (
    <div className={styles.bar} role="group" aria-label="Status da conexão e câmera">
      <StatusPill tone={connection.tone} pulse={connection.pulse} size="sm" live>
        {connection.label}
      </StatusPill>
      <span className={cx(styles.divider, styles.transportDivider)} aria-hidden="true" />
      <span className={cx(styles.item, styles.transport)}>
        <Radio size={13} aria-hidden="true" />
        {transport === null
          ? 'Nenhuma avaliação recebida'
          : `Último resultado por ${transport === 'websocket' ? 'WebSocket' : 'REST'}`}
      </span>
      {pending && (
        <span className={styles.pending}>
          <Spinner size={11} /> atualizando…
        </span>
      )}
      <span className={cx(styles.divider, styles.hintDivider)} aria-hidden="true" />
      {cameraActions ?? (
        <span className={cx(styles.item, styles.hint)}>
          <Mouse size={13} aria-hidden="true" />
          Arraste para girar · role para aproximar
        </span>
      )}
    </div>
  )
}
