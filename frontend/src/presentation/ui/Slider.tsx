import { type CSSProperties, type ReactNode, useId } from 'react'

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
  /** Ícone à esquerda do rótulo. */
  readonly icon?: ReactNode
  /** Observação sob o controle (ex.: limite FICTÍCIO). */
  readonly note?: ReactNode
  readonly id?: string
  readonly className?: string
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

/**
 * Controle deslizante com trilha preenchida, valor em fonte mono e limites embaixo. Usa o
 * `input type="range"` nativo: teclado (setas, Home, End, PageUp/PageDown) e leitores de tela funcionam
 * sem código extra.
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
  icon,
  note,
  id,
  className,
}: SliderProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const noteId = `${inputId}-note`
  const unavailable = value === undefined || min === undefined || max === undefined
  const fill = sliderFillPercent(value, min, max)

  return (
    <div className={cx(styles.slider, (disabled || unavailable) && styles.disabled, className)}>
      <div className={styles.header}>
        <label htmlFor={inputId} className={styles.label}>
          {icon && (
            <span className={styles.icon} aria-hidden="true">
              {icon}
            </span>
          )}
          {label}
        </label>
        <output htmlFor={inputId} className={styles.value}>
          {value === undefined ? '—' : format(value)}
        </output>
      </div>
      <input
        id={inputId}
        className={styles.range}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value ?? 0}
        disabled={disabled || unavailable}
        aria-describedby={note ? noteId : undefined}
        aria-valuetext={value === undefined ? undefined : format(value)}
        style={{ '--slider-fill': `${fill}%` } as CSSProperties}
        onChange={(event) => onChange(event.currentTarget.valueAsNumber)}
      />
      {min !== undefined && max !== undefined && (
        <div className={styles.bounds} aria-hidden="true">
          <span>{format(min)}</span>
          <span>{format(max)}</span>
        </div>
      )}
      {note && (
        <p className={styles.note} id={noteId}>
          {note}
        </p>
      )}
    </div>
  )
}
