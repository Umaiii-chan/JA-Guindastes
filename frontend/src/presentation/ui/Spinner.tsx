import styles from './Spinner.module.css'

export interface SpinnerProps {
  readonly size?: number
  /** Texto para leitores de tela; sem ele, o indicador é decorativo. */
  readonly label?: string
}

/** Indicador de progresso circular. */
export function Spinner({ size = 16, label }: SpinnerProps) {
  return (
    <span
      className={styles.spinner}
      style={{ width: size, height: size }}
      role={label ? 'status' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  )
}
