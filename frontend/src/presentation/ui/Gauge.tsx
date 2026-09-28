import type { CSSProperties } from 'react'

import { cx } from './cx'
import styles from './Gauge.module.css'
import type { Tone } from './tone'
import { useAnimatedNumber } from './useAnimatedNumber'

export interface GaugeBand {
  /** Início da faixa, na escala da régua (0 a `max`). */
  readonly from: number
  readonly to: number
  readonly tone: Tone
}

export interface GaugeProps {
  /** Utilização em %; `null` quando não há valor (sem avaliação). Acima de `max`, a barra estoura. */
  readonly value: number | null
  readonly max?: number
  /** Cor do preenchimento (a cor da situação). */
  readonly tone: Tone
  /** Nome acessível e rótulo à vista (ex.: "Utilização"). */
  readonly label: string
  /** Faixas desenhadas como um filete sob a régua (ex.: até 100 % verde). */
  readonly bands?: readonly GaugeBand[]
  /** Texto sob o número (ex.: "acima de 100 %"). */
  readonly caption?: string
  readonly fractionDigits?: number
  readonly className?: string
  /** @deprecated Compatibilidade com o medidor circular do ADR-017; a régua ocupa a largura dada. */
  readonly size?: number
}

/** Parte da largura ocupada pela escala de 0 a `max`; o resto é a zona de "excede". */
const SCALE_FRACTION = 0.8
/** Quanto acima de `max` a zona de "excede" representa até o fim (em fração de `max`). */
const OVERFLOW_SPAN = 0.5
const TICKS = Array.from({ length: 11 }, (_, index) => index / 10)

function formatPercent(value: number, fractionDigits: number): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })
}

/** Posição (0 a 100 % da largura) de um valor na régua, com a zona de "excede" depois de `max`. */
function rulerPosition(value: number, max: number): number {
  if (value <= max) return (Math.max(0, value) / max) * SCALE_FRACTION * 100
  const beyond = Math.min(1, (value - max) / (max * OVERFLOW_SPAN))
  return (SCALE_FRACTION + beyond * (1 - SCALE_FRACTION)) * 100
}

/**
 * Utilização como RÉGUA LINEAR GRADUADA (ADR-019 § 2): escala de 0 a 100 % com marcas a cada 10 %,
 * preenchimento na cor da situação e o número em mono grande ao lado. Acima de 100 %, a barra estoura
 * a régua e entra na zona de "excede", marcada em vermelho. O número e a barra animam (desligado com
 * `prefers-reduced-motion`). `role="meter"` com o valor real em `aria-valuetext`, inclusive acima de
 * 100 %. (O nome `Gauge` ficou do medidor circular do ADR-017, para não mexer em quem o usa.)
 */
export function Gauge({
  value,
  max = 100,
  tone,
  label,
  bands = [],
  caption,
  fractionDigits = 1,
  className,
}: GaugeProps) {
  const hasValue = value !== null && Number.isFinite(value)
  const target = hasValue ? Math.max(0, value) : 0
  const animated = useAnimatedNumber(target)
  const over = hasValue && value > max
  const fill = hasValue ? rulerPosition(animated, max) : 0

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
      style={
        {
          '--ruler-scale': `${SCALE_FRACTION * 100}%`,
          '--ruler-fill': `${fill}%`,
        } as CSSProperties
      }
    >
      <div className={styles.readout}>
        <span className={styles.label}>{label}</span>
        <span className={styles.number}>
          {hasValue ? formatPercent(animated, fractionDigits) : '—'}
          {hasValue && <span className={styles.unit}>%</span>}
        </span>
        {caption && <span className={styles.caption}>{caption}</span>}
      </div>
      <div className={styles.ruler} aria-hidden="true">
        <div className={styles.ticks}>
          {TICKS.map((tick, index) => (
            <span
              key={tick}
              className={cx(styles.tick, index % 5 === 0 && styles.tickMajor)}
              style={{ left: `${tick * SCALE_FRACTION * 100}%` }}
            />
          ))}
        </div>
        <div className={styles.track}>
          <span className={styles.overflowZone} />
          {hasValue && <span className={styles.fill} />}
          <span className={styles.limit} />
          {over && <span className={styles.exceeds}>excede</span>}
        </div>
        {bands.length > 0 && (
          <div className={styles.bands}>
            {bands.map((band) => {
              const from = rulerPosition(Math.min(max, band.from), max)
              const to = rulerPosition(Math.min(max, band.to), max)
              return (
                <span
                  key={`${band.from}-${band.to}`}
                  className={cx(styles.band, styles[`band-${band.tone}`])}
                  style={{ left: `${from}%`, width: `${to - from}%` }}
                />
              )
            })}
          </div>
        )}
        <div className={styles.scaleLabels}>
          <span style={{ left: '0%' }}>0</span>
          <span style={{ left: `${SCALE_FRACTION * 50}%` }}>{max / 2}</span>
          <span style={{ left: `${SCALE_FRACTION * 100}%` }}>{max}</span>
        </div>
      </div>
    </div>
  )
}
