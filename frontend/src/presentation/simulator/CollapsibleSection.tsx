import { ChevronDown } from 'lucide-react'
import { type ReactNode, useId } from 'react'

import styles from './EnvironmentSection.module.css'
import { useSectionOpen } from './useSectionOpen'

export interface CollapsibleSectionProps {
  /** Identifica a seção no armazenamento local (estado lembrado). */
  readonly id: string
  readonly title: string
  /** Resumo mostrado no cabeçalho, ao lado do título. */
  readonly summary?: ReactNode
  readonly defaultOpen?: boolean
  /** Avisado quando a seção abre. */
  onOpen?(): void
  readonly children: ReactNode
}

/**
 * Seção recolhível da coluna do simulador (TASK-066): cabeçalho que abre e fecha, estado lembrado e
 * corpo com rolagem própria, para uma seção aberta não empurrar as outras para fora da tela.
 */
export function CollapsibleSection({
  id,
  title,
  summary,
  defaultOpen = false,
  onOpen,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useSectionOpen(id, defaultOpen)
  const bodyId = useId()
  return (
    <section className={styles.section} aria-label={title}>
      <button
        type="button"
        className={styles.header}
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => {
          const next = !open
          setOpen(next)
          if (next) onOpen?.()
        }}
      >
        <span className={styles.title}>{title}</span>
        {summary !== undefined && <span className={styles.summary}>{summary}</span>}
        <ChevronDown
          size={14}
          aria-hidden="true"
          className={styles.chevron}
          data-open={open || undefined}
        />
      </button>
      {open && (
        <div id={bodyId} className={styles.body}>
          {children}
        </div>
      )}
    </section>
  )
}
