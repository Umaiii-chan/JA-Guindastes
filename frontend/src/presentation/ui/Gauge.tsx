import { type CSSProperties, useId } from 'react'

import { cx } from './cx'
import styles from './Gauge.module.css'
import type { Tone } from './tone'
import { useAnimatedNumber } from './useAnimatedNumber'

export interface GaugeBand {
  /** Início da faixa, na escala do medidor (0 a `max`). */
  readonly from: number
  readonly to: number
  readonly tone: Tone
}

export interface GaugeProps {
  /** Utilização em %; `null` quando não há valor (sem avaliação). Acima de `max`, o arco fica cheio. */
  readonly value: number | null
  readonly max?: number
  /** Cor do arco de valor. */
  readonly tone: Tone
  /** Nome acessível (ex.: "Utilização"). */
  readonly label: string
  /** Faixas de cor desenhadas no anel externo (ex.: até 100 % verde). */
  readonly bands?: readonly GaugeBand[]
  /** Texto sob o número (ex.: "acima da capacidade"). */
  readonly caption?: string
  readonly size?: number
  readonly fractionDigits?: number
  readonly className?: string
}

const SWEEP_DEG = 270
const START_DEG = 135

function polar(center: number, radius: number, fraction: number): [number, number] {
  const angle = ((START_DEG + SWEEP_DEG * fraction) * Math.PI) / 180
  return [center + radius * Math.cos(angle), center + radius * Math.sin(angle)]
}

function formatPercent(value: number, fractionDigits: number): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })
}

/**
 * Medidor circular de utilização (0 a 100 %), com faixas de cor, marcas a cada 10 % e animação do arco
 * e do número (desligada com `prefers-reduced-motion`). `role="meter"` com o valor real em
 * `aria-valuetext`, inclusive acima de 100 %.
 */
export function Gauge({
  value,
  max = 100,
  tone,
  label,
  bands = [],
  caption,
  size = 168,
  fractionDigits = 1,
  className,
}: GaugeProps) {
  const gradientId = `gauge-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const hasValue = value !== null && Number.isFinite(value)
  const target = hasValue ? Math.max(0, value) : 0
  const animated = useAnimatedNumber(target)
  const fraction = Math.min(1, Math.max(0, animated / max))
  const over = hasValue && value > max

  const center = size / 2
  const stroke = Math.round(size * 0.066)
  const radius = center - stroke - 10
  const bandRadius = radius + stroke / 2 + 5
  const circumference = 2 * Math.PI * radius
  const arcLength = (circumference * SWEEP_DEG) / 360
  const bandCircumference = 2 * Math.PI * bandRadius
  const bandArc = (bandCircumference * SWEEP_DEG) / 360
  const [capX, capY] = polar(center, radius, fraction)

  const valueText = hasValue
    ? `${formatPercent(value, fractionDigits)} %${caption ? ` — ${caption}` : ''}`
    : `sem valor${caption ? ` — ${caption}` : ''}`

  return (
    <div
      className={cx(styles.gauge, styles[tone], over && styles.over, className)}
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={hasValue ? Math.min(max, Math.max(0, value)) : undefined}
      aria-valuetext={valueText}
      style={{ width: size, height: size, '--gauge-size': `${size}px` } as CSSProperties}
    >
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden="true">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" className={styles.gradientStart} />
            <stop offset="100%" className={styles.gradientEnd} />
          </linearGradient>
        </defs>
        {bands.map((band) => {
          const from = Math.max(0, Math.min(max, band.from)) / max
          const to = Math.max(0, Math.min(max, band.to)) / max
          return (
            <circle
              key={`${band.from}-${band.to}`}
              className={cx(styles.band, styles[`band-${band.tone}`])}
              cx={center}
              cy={center}
              r={bandRadius}
              strokeDasharray={`${bandArc * (to - from)} ${bandCircumference}`}
              strokeDashoffset={-bandArc * from}
              transform={`rotate(${START_DEG} ${center} ${center})`}
            />
          )
        })}
        <circle
          className={styles.track}
          cx={center}
          cy={center}
          r={radius}
          strokeWidth={stroke}
          strokeDasharray={`${arcLength} ${circumference}`}
          transform={`rotate(${START_DEG} ${center} ${center})`}
        />
        {Array.from({ length: 11 }, (_, index) => {
          const tickFraction = index / 10
          const major = index % 5 === 0
          const [x1, y1] = polar(center, radius - stroke / 2 - 3, tickFraction)
          const [x2, y2] = polar(center, radius - stroke / 2 - (major ? 9 : 6), tickFraction)
          return (
            <line
              key={index}
              className={cx(styles.tick, major && styles.tickMajor)}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
            />
          )
        })}
        {hasValue && (
          <>
            <circle
              className={styles.value}
              cx={center}
              cy={center}
              r={radius}
              strokeWidth={stroke}
              stroke={`url(#${gradientId})`}
              strokeDasharray={`${arcLength * fraction} ${circumference}`}
              transform={`rotate(${START_DEG} ${center} ${center})`}
            />
            <circle className={styles.cap} cx={capX} cy={capY} r={stroke * 0.42} />
          </>
        )}
      </svg>
      <div className={styles.readout}>
        <span className={styles.number}>
          {hasValue ? formatPercent(animated, fractionDigits) : '—'}
          {hasValue && <span className={styles.unit}>%</span>}
        </span>
        <span className={styles.label}>{label}</span>
        {caption && <span className={styles.caption}>{caption}</span>}
      </div>
    </div>
  )
}
