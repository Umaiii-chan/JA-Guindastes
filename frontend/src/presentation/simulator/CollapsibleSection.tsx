import { ChevronDown } from 'lucide-react'
import { type ReactNode, useId } from 'react'

import styles from './EnvironmentSection.module.css'
import { useInSheet, useOnSheetOpen } from './layout/sheetContext'
import { useSectionOpen } from './useSectionOpen'

export interface CollapsibleSectionProps {
  /** Identifica a seção no armazenamento local (estado lembrado). */
  readonly id: string
  readonly title: string
  /** Resumo mostrado no cabeçalho, ao lado do título. */
  readonly summary?: ReactNode
  readonly defaultOpen?: boolean
  /** Avisado quando a seção abre (ou, dentro de uma folha, quando a folha abre). */
  onOpen?(): void
  readonly children: ReactNode
}

/**
 * Seção recolhível (TASK-066): cabeçalho que abre e fecha, estado lembrado e corpo com rolagem
 * própria. Dentro de uma folha lateral do simulador (TASK-095), a folha já é o "recolher": a seção
 * mostra só o resumo e o conteúdo, sem repetir o título, e o conteúdo nunca é desmontado.
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
  const inSheet = useInSheet()
  useOnSheetOpen(onOpen)

  if (inSheet) {
    return (
      <div className={styles.sheetBody}>
        {summary !== undefined && (
          <p className={styles.sheetSummary}>
            <span className={styles.sheetSummaryLabel}>Situação</span> {summary}
          </p>
        )}
        {children}
      </div>
    )
  }

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
