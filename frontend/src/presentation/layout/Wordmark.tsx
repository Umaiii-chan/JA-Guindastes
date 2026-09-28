import { cx } from '../ui'
import { BrandMark } from './BrandMark'
import styles from './Wordmark.module.css'

export interface WordmarkProps {
  /** `rail`: no trilho (some o texto quando recolhido); `stacked`: telas de entrada, maior. */
  readonly variant?: 'rail' | 'stacked'
  /** Esconde o texto (trilho recolhido), mantendo o símbolo. */
  readonly compact?: boolean
  readonly className?: string
}

/**
 * Identidade própria do simulador (ADR-019 § 4): o símbolo e o wordmark tipográfico "TABELA DE CARGA"
 * em Plex Sans condensada e bold, com "SIMULADOR" em caixa alta espaçada. Texto real, não imagem.
 */
export function Wordmark({ variant = 'rail', compact = false, className }: WordmarkProps) {
  return (
    <span className={cx(styles.wordmark, styles[variant], compact && styles.compact, className)}>
      <span className={styles.symbol}>
        <BrandMark size={variant === 'stacked' ? 40 : 30} />
      </span>
      <span className={styles.words}>
        <span className={styles.main}>Tabela de Carga</span>
        <span className={styles.sub}>Simulador</span>
      </span>
    </span>
  )
}
