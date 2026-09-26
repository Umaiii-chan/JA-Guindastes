import type { ReactNode } from 'react'

import { cx } from '../ui'
import styles from './Page.module.css'

export interface PageProps {
  /** Frase de abertura sob a barra superior (opcional). */
  readonly intro?: ReactNode
  readonly actions?: ReactNode
  readonly width?: 'default' | 'narrow' | 'wide'
  readonly className?: string
  readonly children: ReactNode
}

/** Contêiner das páginas comuns (tudo menos o simulador): margens, largura máxima e entrada suave. */
export function Page({ intro, actions, width = 'default', className, children }: PageProps) {
  return (
    <div className={cx(styles.page, styles[width], className)}>
      {(intro || actions) && (
        <div className={styles.intro}>
          {intro && <div className={styles.introText}>{intro}</div>}
          {actions && <div className={styles.actions}>{actions}</div>}
        </div>
      )}
      {children}
    </div>
  )
}
