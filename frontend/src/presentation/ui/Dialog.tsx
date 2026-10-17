import { X } from 'lucide-react'
import { type ReactNode, useId, useRef } from 'react'
import { createPortal } from 'react-dom'

import { cx } from './cx'
import styles from './Dialog.module.css'
import { IconButton } from './IconButton'
import { usePortalTarget } from './portalTarget'
import { useModal } from './useModal'

export interface DialogProps {
  readonly open: boolean
  readonly onClose: () => void
  readonly title: ReactNode
  readonly description?: ReactNode
  /** Botões do rodapé (ex.: Cancelar / Confirmar). */
  readonly footer?: ReactNode
  readonly size?: 'sm' | 'md' | 'lg'
  readonly children?: ReactNode
}

/**
 * Janela modal (`role="dialog"`, `aria-modal`): foco preso dentro, Esc ou clique fora fecham e o foco
 * volta para o controle que abriu.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  footer,
  size = 'md',
  children,
}: DialogProps) {
  const id = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const portalTarget = usePortalTarget()
  useModal(open, panelRef, onClose, portalTarget)

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
        className={cx(styles.dialog, styles[size])}
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
        {children && <div className={styles.body}>{children}</div>}
        {footer && <footer className={styles.footer}>{footer}</footer>}
      </div>
    </div>,
    portalTarget,
  )
}
