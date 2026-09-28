import { type ButtonHTMLAttributes, forwardRef, type ReactNode } from 'react'

import styles from './Button.module.css'
import { cx } from './cx'
import { Spinner } from './Spinner'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant
  readonly size?: ButtonSize
  /** Ícone antes do texto (ex.: `<ArrowRight size={16} />`). */
  readonly icon?: ReactNode
  /** Ícone depois do texto. */
  readonly iconAfter?: ReactNode
  /** Mostra o indicador de progresso, marca `aria-busy` e bloqueia novos cliques. */
  readonly loading?: boolean
  readonly fullWidth?: boolean
}

/** Botão do manual técnico: primário (laranja), secundário (contorno), fantasma ou de perigo. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'secondary',
    size = 'md',
    icon,
    iconAfter,
    loading = false,
    fullWidth = false,
    disabled,
    type = 'button',
    className,
    children,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx(
        styles.button,
        styles[variant],
        styles[size],
        fullWidth && styles.fullWidth,
        loading && styles.loading,
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner size={size === 'lg' ? 18 : 14} /> : icon}
      {children !== undefined && <span className={styles.label}>{children}</span>}
      {!loading && iconAfter}
    </button>
  )
})
