import { type KeyboardEvent, type ReactNode, useId, useRef, useState } from 'react'

import { cx } from './cx'
import styles from './Tabs.module.css'

export interface TabItem {
  readonly id: string
  readonly label: ReactNode
  readonly icon?: ReactNode
  readonly disabled?: boolean
  readonly content: ReactNode
}

export interface TabsProps {
  readonly items: readonly TabItem[]
  /** Nome acessível da lista de abas. */
  readonly label: string
  /** Aba escolhida (controlado). Sem ela, o componente guarda a escolha. */
  readonly value?: string
  readonly defaultValue?: string
  readonly onChange?: (id: string) => void
  readonly className?: string
}

/**
 * Abas com o padrão WAI-ARIA: setas esquerda/direita, Home e End movem o foco e escolhem a aba
 * (ativação automática); só a aba escolhida entra na ordem do Tab.
 */
export function Tabs({ items, label, value, defaultValue, onChange, className }: TabsProps) {
  const baseId = useId()
  const firstEnabled = items.find((item) => !item.disabled)?.id
  const [ownValue, setOwnValue] = useState(defaultValue ?? firstEnabled)
  const selected = value ?? ownValue
  const tabRefs = useRef(new Map<string, HTMLButtonElement>())

  const select = (id: string) => {
    if (value === undefined) setOwnValue(id)
    onChange?.(id)
  }

  const enabled = items.filter((item) => !item.disabled)

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = enabled.findIndex((item) => item.id === selected)
    let next: (typeof enabled)[number] | undefined
    if (event.key === 'ArrowRight') next = enabled[(index + 1) % enabled.length]
    else if (event.key === 'ArrowLeft')
      next = enabled[(index - 1 + enabled.length) % enabled.length]
    else if (event.key === 'Home') next = enabled[0]
    else if (event.key === 'End') next = enabled[enabled.length - 1]
    if (!next) return
    event.preventDefault()
    select(next.id)
    tabRefs.current.get(next.id)?.focus()
  }

  return (
    <div className={cx(styles.tabs, className)}>
      <div className={styles.list} role="tablist" aria-label={label} onKeyDown={handleKeyDown}>
        {items.map((item) => {
          const isSelected = item.id === selected
          return (
            <button
              key={item.id}
              ref={(element) => {
                if (element) tabRefs.current.set(item.id, element)
                else tabRefs.current.delete(item.id)
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${item.id}`}
              aria-selected={isSelected}
              aria-controls={`${baseId}-panel-${item.id}`}
              tabIndex={isSelected ? 0 : -1}
              disabled={item.disabled}
              className={cx(styles.tab, isSelected && styles.selected)}
              onClick={() => select(item.id)}
            >
              {item.icon && (
                <span className={styles.icon} aria-hidden="true">
                  {item.icon}
                </span>
              )}
              {item.label}
            </button>
          )
        })}
      </div>
      {items.map((item) => (
        <div
          key={item.id}
          role="tabpanel"
          id={`${baseId}-panel-${item.id}`}
          aria-labelledby={`${baseId}-tab-${item.id}`}
          hidden={item.id !== selected}
          tabIndex={0}
          className={styles.panel}
        >
          {item.id === selected && item.content}
        </div>
      ))}
    </div>
  )
}
