import type { ReactNode } from 'react'

import { cx } from '../../ui'
import type { SimulatorSheetId } from './simulatorLayout'
import styles from './SimulatorToolbar.module.css'

export interface SimulatorToolbarItem {
  readonly id: SimulatorSheetId
  /** Nome acessível; começa pelo texto à vista (WCAG 2.5.3). */
  readonly label: string
  /** Texto curto sob o ícone. */
  readonly caption: string
  readonly icon: ReactNode
  /** Id da folha que o botão abre (`aria-controls`). */
  readonly controls: string
  /** Algo em curso nessa folha (ex.: trajetória executando): marca no ícone e no nome. */
  readonly busy?: string
}

export interface SimulatorToolbarProps {
  readonly items: readonly SimulatorToolbarItem[]
  readonly active: SimulatorSheetId | null
  onToggle(id: SimulatorSheetId): void
}

/**
 * Barra de ferramentas vertical do simulador (TASK-095; ADR-042): um botão por folha lateral, com o
 * ícone e um rótulo curto embaixo, como o índice de uma prancha. A folha aberta fica marcada com o
 * filete laranja; clicar de novo fecha.
 */
export function SimulatorToolbar({ items, active, onToggle }: SimulatorToolbarProps) {
  return (
    <nav className={styles.toolbar} aria-label="Painéis do simulador">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={cx(styles.item, active === item.id && styles.active)}
          aria-label={item.busy ? `${item.label} (${item.busy})` : item.label}
          aria-expanded={active === item.id}
          aria-controls={item.controls}
          data-sheet-toggle={item.id}
          title={item.busy ? `${item.label}: ${item.busy}` : item.label}
          onClick={() => onToggle(item.id)}
        >
          <span className={styles.icon} aria-hidden="true">
            {item.icon}
          </span>
          <span className={styles.caption} aria-hidden="true">
            {item.caption}
          </span>
          {item.busy && <span className={styles.busy} aria-hidden="true" />}
        </button>
      ))}
    </nav>
  )
}
