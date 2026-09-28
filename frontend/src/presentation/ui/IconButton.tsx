import { type ButtonHTMLAttributes, forwardRef, type ReactNode } from 'react'

import { cx } from './cx'
import styles from './IconButton.module.css'

export interface IconButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'aria-label' | 'children'
> {
  /** Nome acessível, obrigatório (o botão não tem texto). Também vira a dica ao passar o mouse. */
  readonly label: string
  readonly icon: ReactNode
  /** `glass` fica por compatibilidade com o ADR-017 e desenha como `solid`. */
  readonly variant?: 'ghost' | 'solid' | 'glass'
  readonly size?: 'sm' | 'md'
  /** Botão de alternância: vira `aria-pressed`. */
  readonly pressed?: boolean
  /** Lado da dica; `none` a esconde (quando o rótulo já está visível ao lado). */
  readonly tooltip?: 'top' | 'bottom' | 'right' | 'left' | 'none'
}

/** Botão só com ícone, com nome acessível e dica visual. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  {
    label,
    icon,
    variant = 'ghost',
    size = 'md',
    pressed,
    tooltip = 'bottom',
    type = 'button',
    className,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      aria-pressed={pressed}
      data-tooltip={tooltip === 'none' ? undefined : label}
      data-tooltip-side={tooltip === 'none' ? undefined : tooltip}
      className={cx(
        styles.iconButton,
        styles[variant === 'glass' ? 'solid' : variant],
        styles[size],
        className,
      )}
      {...rest}
    >
      <span className={styles.icon} aria-hidden="true">
        {icon}
      </span>
    </button>
  )
})
