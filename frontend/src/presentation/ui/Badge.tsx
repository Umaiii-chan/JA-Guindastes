import type { ReactNode } from 'react'

import styles from './Badge.module.css'
import { cx } from './cx'
import type { Tone } from './tone'

export interface BadgeProps {
  readonly tone?: Tone
  /** `soft`: fundo tingido; `outline`: só a borda; `solid`: cor cheia (selos como PROVISÓRIO). */
  readonly variant?: 'soft' | 'outline' | 'solid'
  readonly icon?: ReactNode
  readonly className?: string
  readonly title?: string
  readonly children: ReactNode
}

/** Selo curto: rótulo técnico (FICTÍCIO, PROVISÓRIO, backend), contagem ou categoria. */
export function Badge({
  tone = 'neutral',
  variant = 'soft',
  icon,
  className,
  title,
  children,
}: BadgeProps) {
  return (
    <span className={cx(styles.badge, styles[tone], styles[variant], className)} title={title}>
      {icon && (
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
      )}
      {children}
    </span>
  )
}

export interface StatusPillProps {
  readonly tone: Tone
  readonly children: ReactNode
  /** Pulso no ponto de cor (ex.: conectando, atualizando). Desligado com `prefers-reduced-motion`. */
  readonly pulse?: boolean
  readonly size?: 'sm' | 'md' | 'lg'
  readonly className?: string
  /** `status` anuncia mudanças para leitores de tela (padrão: nenhum papel). */
  readonly live?: boolean
}

/** Situação com ponto de cor: verde, âmbar, vermelho, cinza ou ciano. */
export function StatusPill({
  tone,
  children,
  pulse = false,
  size = 'md',
  className,
  live = false,
}: StatusPillProps) {
  return (
    <span
      className={cx(styles.pill, styles[tone], styles[`pill-${size}`], className)}
      role={live ? 'status' : undefined}
      data-tone={tone}
    >
      <span className={cx(styles.dot, pulse && styles.pulse)} aria-hidden="true" />
      <span>{children}</span>
    </span>
  )
}
