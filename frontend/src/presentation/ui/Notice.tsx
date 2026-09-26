import { CircleAlert, Info, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'

import { cx } from './cx'
import styles from './Notice.module.css'
import type { Tone } from './tone'

export interface NoticeProps {
  readonly tone?: Tone
  readonly title?: ReactNode
  /** Ícone próprio; padrão conforme o tom. */
  readonly icon?: ReactNode
  /** `note` (padrão) para avisos permanentes; `alert` para erros que precisam ser anunciados. */
  readonly role?: 'note' | 'alert' | 'status'
  readonly compact?: boolean
  readonly className?: string
  readonly children?: ReactNode
}

const DEFAULT_ICON: Record<Tone, ReactNode> = {
  ok: <Info size={16} />,
  info: <Info size={16} />,
  neutral: <Info size={16} />,
  warning: <TriangleAlert size={16} />,
  danger: <CircleAlert size={16} />,
}

/** Aviso em bloco com ícone e barra lateral de cor (ex.: dados FICTÍCIOS, estratégia PROVISÓRIA). */
export function Notice({
  tone = 'info',
  title,
  icon,
  role = 'note',
  compact = false,
  className,
  children,
}: NoticeProps) {
  return (
    <div
      className={cx(styles.notice, styles[tone], compact && styles.compact, className)}
      role={role}
    >
      <span className={styles.icon} aria-hidden="true">
        {icon ?? DEFAULT_ICON[tone]}
      </span>
      <div className={styles.content}>
        {title && <p className={styles.title}>{title}</p>}
        {children && <div className={styles.body}>{children}</div>}
      </div>
    </div>
  )
}
