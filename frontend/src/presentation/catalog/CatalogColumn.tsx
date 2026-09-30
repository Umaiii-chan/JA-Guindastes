import { ChevronRight } from 'lucide-react'
import { type KeyboardEvent, type ReactNode, useRef } from 'react'

import { cx, EmptyState, Panel, Skeleton } from '../ui'
import styles from './catalog.module.css'

export interface CatalogColumnItem {
  readonly id: string
  readonly label: string
  /** Linha de apoio (ex.: contagens). */
  readonly meta?: ReactNode
  /** Selo à direita (ex.: "sem ficha"). */
  readonly badge?: ReactNode
}

export interface CatalogColumnProps {
  readonly title: string
  /** Carimbo da coluna (ex.: "01"). */
  readonly stamp: string
  readonly items: readonly CatalogColumnItem[]
  readonly selectedId: string | null
  onSelect(id: string): void
  readonly loading: boolean
  /** O que mostrar sem itens (vazio, bloqueado ou sem resultado da busca). */
  readonly empty: ReactNode
  /** Ações do cabeçalho (ex.: "Novo"). */
  readonly actions?: ReactNode
  /** Termo da busca, para destacar no nome. */
  readonly highlight?: string
  /** Mostra a seta "tem nível abaixo". */
  readonly hasChildren?: boolean
}

/**
 * Uma coluna do índice de fichas (fabricante → guindaste → configuração; ADR-019): lista com
 * filetes, número de ordem e contagens em mono, e o item escolhido marcado pelo traço laranja à
 * esquerda. Cada item é um botão com `aria-current` no escolhido; setas para cima e para baixo, Home
 * e End movem o foco.
 */
export function CatalogColumn({
  title,
  stamp,
  items,
  selectedId,
  onSelect,
  loading,
  empty,
  actions,
  highlight = '',
  hasChildren = false,
}: CatalogColumnProps) {
  const listRef = useRef<HTMLUListElement>(null)

  const handleKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const buttons = Array.from(listRef.current?.querySelectorAll('button') ?? [])
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
    let next: HTMLButtonElement | undefined
    if (event.key === 'ArrowDown') next = buttons[Math.min(buttons.length - 1, index + 1)]
    else if (event.key === 'ArrowUp') next = buttons[Math.max(0, index - 1)]
    else if (event.key === 'Home') next = buttons[0]
    else if (event.key === 'End') next = buttons[buttons.length - 1]
    if (!next) return
    event.preventDefault()
    next.focus()
  }

  return (
    <Panel
      title={title}
      stamp={stamp}
      flush
      className={styles.column}
      actions={
        <>
          {!loading && (
            <span className={styles.columnCount}>
              <span className={styles.columnCountLabel} aria-hidden="true">
                Qtd.
              </span>
              <span className="visually-hidden">Itens na lista: </span>
              {String(items.length).padStart(2, '0')}
            </span>
          )}
          {actions}
        </>
      }
    >
      {loading ? (
        <div className={styles.columnSkeleton} aria-busy="true">
          <span className="visually-hidden">Carregando {title.toLowerCase()}…</span>
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className={styles.columnSkeletonItem}>
              <Skeleton width={index % 2 ? '58%' : '74%'} height={13} />
              <Skeleton width="40%" height={10} />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className={styles.columnEmpty}>{empty}</div>
      ) : (
        <ul className={styles.list} ref={listRef} onKeyDown={handleKeyDown} aria-label={title}>
          {items.map((item) => {
            const selected = item.id === selectedId
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className={cx(styles.item, selected && styles.itemSelected)}
                  aria-current={selected ? 'true' : undefined}
                  onClick={() => onSelect(item.id)}
                >
                  <span className={styles.itemText}>
                    <span className={styles.itemLabel}>
                      <Highlight text={item.label} term={highlight} />
                    </span>
                    {item.meta && <span className={styles.itemMeta}>{item.meta}</span>}
                  </span>
                  {item.badge}
                  {hasChildren && (
                    <ChevronRight size={15} className={styles.itemChevron} aria-hidden="true" />
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}

/** Destaca o termo da busca no texto (sem diferenciar maiúsculas; acentos contam como estão). */
function Highlight({ text, term }: { readonly text: string; readonly term: string }) {
  const needle = term.trim().toLowerCase()
  const index = needle === '' ? -1 : text.toLowerCase().indexOf(needle)
  if (index < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, index)}
      <mark className={styles.mark}>{text.slice(index, index + needle.length)}</mark>
      {text.slice(index + needle.length)}
    </>
  )
}

/** Estado vazio compacto das colunas. */
export function ColumnEmpty(props: {
  readonly icon: ReactNode
  readonly title: string
  readonly description?: ReactNode
  readonly action?: ReactNode
  readonly tone?: 'info' | 'neutral' | 'danger'
}) {
  return <EmptyState compact {...props} tone={props.tone ?? 'neutral'} />
}
