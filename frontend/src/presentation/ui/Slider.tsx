import { type CSSProperties, type KeyboardEvent, type ReactNode, useId } from 'react'

import { cx } from './cx'
import styles from './Slider.module.css'

export interface SliderProps {
  readonly label: ReactNode
  /** `undefined` enquanto não há valor (o controle fica desabilitado e mostra "—"). */
  readonly value: number | undefined
  readonly min: number | undefined
  readonly max: number | undefined
  readonly step?: number
  readonly disabled?: boolean
  /** Formata o valor e os limites (ex.: `12,5 m`). */
  readonly format?: (value: number) => string
  readonly onChange: (value: number) => void
  /** Observação sob o controle (ex.: limite FICTÍCIO). */
  readonly note?: ReactNode
  /**
   * Escala que dá a volta (giro contínuo; TASK-092): nas pontas, as setas continuam e `onChange`
   * recebe um valor além do limite (ex.: 181 com máximo 180), que quem comanda traz de volta à faixa.
   */
  readonly wraps?: boolean
  /** @deprecated Compatibilidade com o ADR-017: ícone pequeno antes do rótulo. O ADR-019 dispensa. */
  readonly icon?: ReactNode
  readonly id?: string
  readonly className?: string
  /**
   * Versão compacta para a barra de comando do simulador (TASK-095): rótulo em caixa alta pequena,
   * valor em mono ao lado, sem os limites embaixo; a observação fica para leitores de tela (o
   * marcador `*` ao lado do rótulo a mostra ao passar o mouse).
   */
  readonly compact?: boolean
  /**
   * Rótulo curto à vista (ex.: "Cabo"), com o `label` completo como nome acessível e dica. O rótulo
   * curto é parte do completo (WCAG 2.5.3).
   */
  readonly shortLabel?: string
}

/** Fração preenchida da trilha, de 0 a 100, para o CSS (`--slider-fill`). */
function sliderFillPercent(
  value: number | undefined,
  min: number | undefined,
  max: number | undefined,
): number {
  if (value === undefined || min === undefined || max === undefined || max <= min) return 0
  return Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100))
}

/** Marcas da escala: a cada 10 % do curso, maiores no início, no meio e no fim. */
const TICKS = Array.from({ length: 11 }, (_, index) => index * 10)

/**
 * Controle deslizante como escala graduada (ADR-019 § 2): filete fino com marcas a cada 10 %, trecho
 * percorrido em tinta, cursor retangular e valor em mono. Usa o `input type="range"` nativo por cima
 * da escala desenhada: teclado (setas, Home, End, PageUp/PageDown) e leitores de tela funcionam sem
 * código extra.
 */
export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  disabled = false,
  format = String,
  onChange,
  note,
  wraps = false,
  icon,
  id,
  className,
  compact = false,
  shortLabel,
}: SliderProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const noteId = `${inputId}-note`
  const unavailable = value === undefined || min === undefined || max === undefined
  const fill = sliderFillPercent(value, min, max)
  // Na ponta, o controle nativo ignora a seta; com volta, o passo segue além do limite.
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!wraps || disabled || value === undefined || min === undefined || max === undefined) return
    const forward = event.key === 'ArrowRight' || event.key === 'ArrowUp'
    const backward = event.key === 'ArrowLeft' || event.key === 'ArrowDown'
    if (forward && value >= max) {
      event.preventDefault()
      onChange(value + step)
    } else if (backward && value <= min) {
      event.preventDefault()
      onChange(value - step)
    }
  }

  return (
    <div
      className={cx(
        styles.slider,
        compact && styles.compact,
        (disabled || unavailable) && styles.disabled,
        className,
      )}
    >
      <div className={styles.header}>
        <label
          htmlFor={inputId}
          className={styles.label}
          title={shortLabel !== undefined && typeof label === 'string' ? label : undefined}
        >
          {icon && (
            <span className={styles.icon} aria-hidden="true">
              {icon}
            </span>
          )}
          {shortLabel ?? label}
        </label>
        {compact && note && (
          <button
            type="button"
            className={styles.noteMark}
            aria-label={`Observação sobre ${typeof label === 'string' ? label : 'o controle'}`}
            aria-describedby={noteId}
          >
            *
          </button>
        )}
        <output htmlFor={inputId} className={styles.value}>
          {value === undefined ? '—' : format(value)}
        </output>
      </div>
      <div className={styles.control} style={{ '--slider-fill': `${fill}%` } as CSSProperties}>
        <span className={styles.scale} aria-hidden="true">
          {TICKS.map((tick) => (
            <span
              key={tick}
              className={cx(styles.tick, tick % 50 === 0 && styles.tickMajor)}
              style={{ left: `${tick}%` }}
            />
          ))}
          <span className={styles.fill} />
        </span>
        <input
          id={inputId}
          className={styles.range}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value ?? 0}
          disabled={disabled || unavailable}
          aria-label={shortLabel !== undefined && typeof label === 'string' ? label : undefined}
          aria-describedby={note ? noteId : undefined}
          aria-valuetext={value === undefined ? undefined : format(value)}
          onChange={(event) => onChange(event.currentTarget.valueAsNumber)}
          onKeyDown={wraps ? handleKeyDown : undefined}
        />
      </div>
      {min !== undefined && max !== undefined && (
        <div className={cx(styles.bounds, compact && styles.boundsFloating)} aria-hidden="true">
          <span>{format(min)}</span>
          <span>{format(max)}</span>
        </div>
      )}
      {note && (
        <p className={cx(styles.note, compact && styles.noteFloating)} id={noteId}>
          {note}
        </p>
      )}
    </div>
  )
}
