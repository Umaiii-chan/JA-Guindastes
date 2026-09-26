import type { ButtonSize, ButtonVariant } from './Button'
import styles from './Button.module.css'
import { cx } from './cx'

/**
 * Classes do `Button` para outros elementos com cara de botão (ex.: o `Link` do roteador, que navega
 * em vez de executar uma ação).
 */
export function buttonClassName(
  variant: ButtonVariant = 'secondary',
  size: ButtonSize = 'md',
  extra?: string,
): string {
  return cx(styles.button, styles[variant], styles[size], extra)
}
