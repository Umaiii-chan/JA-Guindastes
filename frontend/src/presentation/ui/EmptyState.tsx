import type { ReactNode } from 'react'

import { cx } from './cx'
import styles from './EmptyState.module.css'
import type { Tone } from './tone'

export interface EmptyStateProps {
  readonly icon: ReactNode
  readonly title: ReactNode
  /** O que fazer agora: texto útil, não só "nada aqui". */
  readonly description?: ReactNode
  /** Ação principal (ex.: botão "Cadastrar fabricante"). */
  readonly action?: ReactNode
  readonly tone?: Tone
  readonly compact?: boolean
  /** `alert` para estados de erro; `status` para vazio que muda com o tempo. */
  readonly role?: 'alert' | 'status'
  readonly className?: string
}

/** Estado vazio, bloqueado ou de erro, com ícone, título, orientação e ação. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  tone = 'info',
  compact = false,
  role,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cx(styles.empty, styles[tone], compact && styles.compact, className)}
      role={role}
    >
      <span className={styles.iconWrap} aria-hidden="true">
        <span className={styles.icon}>{icon}</span>
      </span>
      <p className={styles.title}>{title}</p>
      {description && <div className={styles.description}>{description}</div>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  )
}
