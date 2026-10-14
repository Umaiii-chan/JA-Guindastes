import { ChevronDown } from 'lucide-react'
import { type ReactNode, useId, useState } from 'react'

import styles from './EnvironmentSection.module.css'

export interface EnvironmentSectionProps {
  /** Resumo do cenário em edição, mostrado no cabeçalho (ex.: "2 feições · 1 obstáculo"). */
  readonly summary: ReactNode
  /** Avisado quando a seção abre (a tela carrega a lista de cenários salvos). */
  onOpen?(): void
  readonly children: ReactNode
}

/**
 * Seção "Ambiente" da coluna de procedimento (TASK-052): recolhida por padrão, abaixo dos passos, para
 * o editor de terreno e obstáculos não competir com o procedimento guiado. O conteúdo só é montado
 * enquanto a seção está aberta.
 */
export function EnvironmentSection({ summary, onOpen, children }: EnvironmentSectionProps) {
  const [open, setOpen] = useState(false)
  const bodyId = useId()
  return (
    <section className={styles.section} aria-label="Ambiente">
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
        <span className={styles.title}>Ambiente</span>
        <span className={styles.summary}>{summary}</span>
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
