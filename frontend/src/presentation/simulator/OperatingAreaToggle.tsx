import { cx } from '../ui'
import styles from './OperatingAreaToggle.module.css'

export interface OperatingAreaToggleProps {
  readonly enabled: boolean
  readonly onToggle: (enabled: boolean) => void
  /** Calculando a área no backend. */
  readonly loading?: boolean
  /** Mensagem de erro do cálculo, ou `null`. */
  readonly error?: string | null
}

/**
 * Liga e desliga a área de operação no chão da cena (TASK-055; ADR-025), na barra do quadro, com a
 * legenda das três cores quando ligada. A cor de cada célula vem do backend (RN-008).
 */
export function OperatingAreaToggle({
  enabled,
  onToggle,
  loading = false,
  error = null,
}: OperatingAreaToggleProps) {
  return (
    <div className={styles.group} role="group" aria-label="Área de operação">
      <button
        type="button"
        className={cx(styles.toggle, enabled && styles.selected)}
        aria-pressed={enabled}
        title="Mostra no chão onde a carga atual fica dentro da tabela (verde), perto do limite (amarelo) ou acima dele ou fora da tabela (vermelho)"
        onClick={() => onToggle(!enabled)}
      >
        Área de operação
      </button>
      {enabled && (
        <span className={styles.legend} aria-live="polite">
          {error !== null ? (
            <span className={styles.error} role="alert">
              {error}
            </span>
          ) : loading ? (
            <span className={styles.muted}>calculando…</span>
          ) : (
            <>
              <span className={styles.item}>
                <i className={cx(styles.swatch, styles.green)} aria-hidden="true" />
                Dentro
              </span>
              <span className={styles.item}>
                <i className={cx(styles.swatch, styles.yellow)} aria-hidden="true" />
                Atenção
              </span>
              <span className={styles.item}>
                <i className={cx(styles.swatch, styles.red)} aria-hidden="true" />
                Acima ou fora
              </span>
            </>
          )}
        </span>
      )}
    </div>
  )
}
