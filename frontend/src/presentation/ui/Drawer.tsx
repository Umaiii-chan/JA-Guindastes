import { X } from 'lucide-react'
import { type ReactNode, useId, useRef } from 'react'
import { createPortal } from 'react-dom'

import { cx } from './cx'
import styles from './Drawer.module.css'
import { IconButton } from './IconButton'
import { usePortalTarget } from './portalTarget'
import { useModal } from './useModal'

export interface DrawerProps {
  readonly open: boolean
  readonly onClose: () => void
  readonly title: ReactNode
  readonly description?: ReactNode
  readonly side?: 'right' | 'left'
  readonly width?: number
  readonly footer?: ReactNode
  readonly children?: ReactNode
}

/**
 * Painel lateral modal (detalhes, edição). Mesmo comportamento do `Dialog`: foco preso, Esc e clique
 * fora fecham, foco devolvido ao fechar.
 */
export function Drawer({
  open,
  onClose,
  title,
  description,
  side = 'right',
  width = 440,
  footer,
  children,
}: DrawerProps) {
  const id = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  useModal(open, panelRef, onClose)
  const portalTarget = usePortalTarget()

  if (!open) return null

  return createPortal(
    <div className={styles.backdrop} onMouseDown={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={description ? `${id}-description` : undefined}
        tabIndex={-1}
        className={cx(styles.drawer, styles[side])}
        style={{ width: `min(${width}px, 100vw)` }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className={styles.header}>
          <div className={styles.headings}>
            <h2 id={`${id}-title`} className={styles.title}>
              {title}
            </h2>
            {description && (
              <p id={`${id}-description`} className={styles.description}>
                {description}
              </p>
            )}
          </div>
          <IconButton label="Fechar" icon={<X size={18} />} tooltip="none" onClick={onClose} />
        </header>
        <div className={styles.body}>{children}</div>
        {footer && <footer className={styles.footer}>{footer}</footer>}
      </div>
    </div>,
    portalTarget,
  )
}
