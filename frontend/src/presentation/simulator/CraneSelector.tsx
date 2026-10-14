import { cx } from '../ui'
import styles from './CraneSelector.module.css'

export interface CraneSelectorProps {
  /** Guindastes da cena, na ordem ("Guindaste 1", "Guindaste 2"…). */
  readonly cranes: readonly { readonly id: string; readonly label: string }[]
  readonly selectedId: string
  onSelect(id: string): void
}

/**
 * Escolhe qual guindaste os controles comandam (TASK-074). Só aparece com mais de um guindaste na
 * cena.
 */
export function CraneSelector({ cranes, selectedId, onSelect }: CraneSelectorProps) {
  return (
    <div className={styles.group} role="group" aria-label="Guindaste comandado">
      {cranes.map((crane) => (
        <button
          key={crane.id}
          type="button"
          className={cx(styles.option, crane.id === selectedId && styles.on)}
          aria-pressed={crane.id === selectedId}
          onClick={() => onSelect(crane.id)}
        >
          {crane.label}
        </button>
      ))}
    </div>
  )
}
