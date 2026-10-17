import { X } from 'lucide-react'
import type { ReactNode } from 'react'

import { IconButton } from '../../ui'
import { SheetContext, type SheetState } from './sheetContext'
import styles from './SimulatorSheet.module.css'

export interface SimulatorSheetProps {
  /** Id do elemento (o `aria-controls` do botão da barra de ferramentas). */
  readonly id: string
  readonly title: string
  readonly open: boolean
  onClose(): void
  readonly children: ReactNode
}

const OPEN: SheetState = { open: true }
const CLOSED: SheetState = { open: false }

/**
 * Folha lateral NÃO modal sobre a cena (TASK-095; ADR-045): título, fechar e o conteúdo com rolagem
 * própria. Fechada, a folha fica `hidden` — o conteúdo continua montado (F-20).
 */
export function SimulatorSheet({ id, title, open, onClose, children }: SimulatorSheetProps) {
  const titleId = `${id}-title`
  return (
    <section id={id} className={styles.sheet} aria-labelledby={titleId} hidden={!open}>
      <header className={styles.header}>
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        <IconButton
          label="Fechar a folha"
          icon={<X size={16} />}
          size="sm"
          tooltip="left"
          onClick={onClose}
        />
      </header>
      <div className={styles.body}>
        <SheetContext.Provider value={open ? OPEN : CLOSED}>{children}</SheetContext.Provider>
      </div>
    </section>
  )
}
