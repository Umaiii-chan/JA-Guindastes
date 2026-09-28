import { useId } from 'react'

import { cx } from '../ui'
import styles from './PivotFigure.module.css'

export interface PivotFigureProps {
  /** a (m): distância horizontal do eixo de giro ao pino da lança; negativa = pino atrás do eixo. */
  readonly offsetM: number
  readonly className?: string
}

// Vista lateral esquemática, frente do chassi à direita. Fora de escala: só a posição (atrás, sobre
// ou à frente do eixo) segue o sinal de a.
const GROUND = 84
const AXIS = 92
const PIVOT_Y = 40
const OFFSET = 30

/**
 * Figura cotada de a e h (ADR-013 C-4), como o detalhe de uma prancha: eixo de giro em traço-ponto,
 * o pino da lança e as duas cotas com setas. Decorativa: os valores estão na tabela ao lado.
 */
export function PivotFigure({ offsetM, className }: PivotFigureProps) {
  const arrowId = `${useId()}-arrow`
  const arrow = `url(#${arrowId})`
  const pivotX = AXIS + Math.sign(offsetM) * OFFSET
  const hasOffset = offsetM !== 0
  const dimX = Math.min(pivotX, AXIS) - 16
  const boomEnd = { x: pivotX + 58, y: PIVOT_Y - 30 }

  return (
    <svg
      className={cx(styles.figure, className)}
      viewBox="0 0 168 104"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <marker
          id={arrowId}
          viewBox="0 0 6 6"
          refX="5.6"
          refY="3"
          markerWidth="5"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <path d="M0 0 L6 3 L0 6 Z" className={styles.arrowHead} />
        </marker>
      </defs>

      {/* Chão, chassi e torre. */}
      <line className={styles.ground} x1="4" y1={GROUND} x2="164" y2={GROUND} />
      <rect className={styles.body} x="34" y={GROUND - 14} width="118" height="10" />
      <circle className={styles.body} cx="50" cy={GROUND - 3} r="3" />
      <circle className={styles.body} cx="136" cy={GROUND - 3} r="3" />
      <rect
        className={styles.body}
        x={Math.min(pivotX, AXIS) - 12}
        y={PIVOT_Y + 4}
        width={Math.abs(pivotX - AXIS) + 24}
        height={GROUND - 14 - PIVOT_Y - 4}
      />

      {/* Lança (trecho), pino e eixo de giro. */}
      <line className={styles.boom} x1={pivotX} y1={PIVOT_Y} x2={boomEnd.x} y2={boomEnd.y} />
      <line className={styles.axis} x1={AXIS} y1="6" x2={AXIS} y2={GROUND + 10} />
      <circle className={styles.pin} cx={pivotX} cy={PIVOT_Y} r="2.6" />

      {/* Cota a: horizontal, acima do pino. */}
      {hasOffset && (
        <>
          <line className={styles.extension} x1={pivotX} y1={PIVOT_Y - 4} x2={pivotX} y2="12" />
          <line
            className={styles.dimension}
            x1={pivotX}
            y1="15"
            x2={AXIS}
            y2="15"
            markerStart={arrow}
            markerEnd={arrow}
          />
          <text className={styles.dimLabel} x={(pivotX + AXIS) / 2} y="11">
            a
          </text>
        </>
      )}

      {/* Cota h: vertical, do chão ao pino. */}
      <line className={styles.extension} x1={pivotX - 4} y1={PIVOT_Y} x2={dimX - 3} y2={PIVOT_Y} />
      <line
        className={styles.dimension}
        x1={dimX}
        y1={PIVOT_Y}
        x2={dimX}
        y2={GROUND}
        markerStart={arrow}
        markerEnd={arrow}
      />
      <text className={styles.dimLabel} x={dimX - 5} y={(PIVOT_Y + GROUND) / 2 + 2}>
        h
      </text>

      <text className={styles.note} x="164" y="100">
        SEM ESCALA
      </text>
    </svg>
  )
}
