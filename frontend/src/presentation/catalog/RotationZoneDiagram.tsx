import { useId } from 'react'

import { formatZoneSector, zoneSpanDeg } from '../../application/catalog/rotationZones'
import type { RotationZone } from '../../domain/catalog/catalog'
import { cx } from '../ui'
import styles from './RotationZoneDiagram.module.css'

export interface RotationZoneDiagramProps {
  readonly zones: readonly RotationZone[]
  /** Zona destacada em laranja (a escolhida ou a da tabela mostrada); `null` = nenhuma. */
  readonly activeCode?: string | null
  /** Lado do quadrado, em px. */
  readonly size?: number
  /** Legenda com número, nome e setor de cada zona (padrão: sim). */
  readonly legend?: boolean
  readonly className?: string
}

const DEG = Math.PI / 180
const VIEW = 120
const CENTER = VIEW / 2
const RADIUS = 40
/** Marcas do transferidor: a cada 10°, maiores a cada 30° e a cada 90°. */
const TICKS = Array.from({ length: 36 }, (_, index) => index * 10)

/**
 * Ponto do círculo para o giro ψ, visto de cima com a frente do chassi para cima (ADR-013: 0° =
 * frente, 90° = esquerda, anti-horário): x = −sen ψ, y = −cos ψ na tela.
 */
function pointAt(psiDeg: number, radius = RADIUS): { x: number; y: number } {
  return {
    x: CENTER - radius * Math.sin(psiDeg * DEG),
    y: CENTER - radius * Math.cos(psiDeg * DEG),
  }
}

const round = (value: number) => Math.round(value * 100) / 100

/** Trecho de arco até o fim da zona, no sentido anti-horário da tela (sweep-flag 0 no SVG). */
function arcTo(zone: RotationZone, radius: number): string {
  const to = pointAt(zone.endDeg, radius)
  const largeArc = zoneSpanDeg(zone) > 180 ? 1 : 0
  return `A ${radius} ${radius} 0 ${largeArc} 0 ${round(to.x)} ${round(to.y)}`
}

/** Arco da zona sobre o círculo. */
function arcPath(zone: RotationZone, radius = RADIUS): string {
  const from = pointAt(zone.startDeg, radius)
  return `M ${round(from.x)} ${round(from.y)} ${arcTo(zone, radius)}`
}

/** Fatia do setor: centro, arco e volta ao centro. */
function sectorPath(zone: RotationZone): string {
  const from = pointAt(zone.startDeg)
  return `M ${CENTER} ${CENTER} L ${round(from.x)} ${round(from.y)} ${arcTo(zone, RADIUS)} Z`
}

/**
 * Setores das zonas de giro (TASK-046) desenhados como um transferidor em traço de tinta (ADR-019),
 * visto de cima com a frente do chassi para cima: marcas a cada 10°, linhas de centro, fronteiras
 * radiais e o número de cada zona num círculo de chamada. As zonas se distinguem pela hachura
 * alternada; só a zona destacada leva o laranja. Conferência visual do cadastro: a zona usada na
 * avaliação é a do backend.
 */
export function RotationZoneDiagram({
  zones,
  activeCode = null,
  size = 120,
  legend = true,
  className,
}: RotationZoneDiagramProps) {
  const hatchId = `${useId()}-hatch`
  const label =
    zones.length === 0
      ? 'Sem zonas de giro: uma tabela vale para todo o giro.'
      : `Setores das zonas de giro, vistos de cima com a frente para cima: ${zones
          .map((zone) => `${zone.name} ${formatZoneSector(zone)}`)
          .join('; ')}.`
  const drawn = zones
    .map((zone, index) => ({ zone, index, span: zoneSpanDeg(zone) }))
    .filter((item) => item.span > 0)
  const active = drawn.find((item) => item.zone.code === activeCode) ?? null

  return (
    <figure className={cx(styles.figure, className)}>
      <svg
        className={styles.svg}
        width={size}
        height={size}
        viewBox={`0 0 ${VIEW} ${VIEW}`}
        role="img"
        aria-label={label}
      >
        <defs>
          <pattern
            id={hatchId}
            width="3.2"
            height="3.2"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line className={styles.hatchLine} x1="0" y1="0" x2="0" y2="3.2" />
          </pattern>
        </defs>

        {/* Linhas de centro (traço-ponto) e marcas do transferidor. */}
        <line
          className={styles.centerLine}
          x1={CENTER}
          y1={CENTER - RADIUS - 9}
          x2={CENTER}
          y2={CENTER + RADIUS + 9}
        />
        <line
          className={styles.centerLine}
          x1={CENTER - RADIUS - 9}
          y1={CENTER}
          x2={CENTER + RADIUS + 9}
          y2={CENTER}
        />
        {TICKS.map((deg) => {
          const length = deg % 90 === 0 ? 5 : deg % 30 === 0 ? 3.5 : 1.8
          const inner = pointAt(deg, RADIUS)
          const outer = pointAt(deg, RADIUS + length)
          return (
            <line
              key={deg}
              className={cx(styles.tick, deg % 30 === 0 && styles.tickMajor)}
              x1={round(inner.x)}
              y1={round(inner.y)}
              x2={round(outer.x)}
              y2={round(outer.y)}
            />
          )
        })}

        {drawn.map(({ zone, index }) => (
          <path
            key={`${zone.code}-${index}`}
            className={cx(styles.sector, zone.code === activeCode && styles.active)}
            fill={index % 2 === 1 ? `url(#${hatchId})` : 'none'}
            d={sectorPath(zone)}
          />
        ))}
        <circle className={styles.base} cx={CENTER} cy={CENTER} r={RADIUS} />
        {/* Arco da zona destacada, em traço laranja por fora do círculo. */}
        {active && <path className={styles.activeArc} d={arcPath(active.zone)} />}

        {drawn.map(({ zone, index }) => {
          const edge = pointAt(zone.startDeg)
          return (
            <line
              key={`edge-${zone.code}-${index}`}
              className={styles.edge}
              x1={CENTER}
              y1={CENTER}
              x2={round(edge.x)}
              y2={round(edge.y)}
            />
          )
        })}

        {drawn.map(({ zone, index, span }) => {
          const at = pointAt(zone.startDeg + span / 2, RADIUS * 0.58)
          const isActive = zone.code === activeCode
          return (
            <g
              key={`label-${zone.code}-${index}`}
              className={cx(styles.callout, isActive && styles.calloutActive)}
              aria-hidden="true"
            >
              <circle cx={round(at.x)} cy={round(at.y)} r={5.6} />
              <text x={round(at.x)} y={round(at.y) + 0.3}>
                {index + 1}
              </text>
            </g>
          )
        })}

        <circle className={styles.pivot} cx={CENTER} cy={CENTER} r={1.6} />
        {/* Frente do chassi (ψ = 0°) e os quadrantes, sentido anti-horário. */}
        <path
          className={styles.front}
          d={`M ${CENTER - 3} ${CENTER - RADIUS - 8} L ${CENTER} ${CENTER - RADIUS - 12} L ${CENTER + 3} ${CENTER - RADIUS - 8}`}
        />
        <text
          className={styles.axisLabel}
          x={CENTER + 5}
          y={CENTER - RADIUS - 8}
          aria-hidden="true"
        >
          0° frente
        </text>
        <text
          className={styles.axisLabel}
          x={CENTER - RADIUS - 10}
          y={CENTER - 2.5}
          aria-hidden="true"
          textAnchor="end"
        >
          90°
        </text>
        <text
          className={styles.axisLabel}
          x={CENTER + 3}
          y={CENTER + RADIUS + 12}
          aria-hidden="true"
          textAnchor="start"
        >
          180°
        </text>
        <text
          className={styles.axisLabel}
          x={CENTER + RADIUS + 10}
          y={CENTER - 2.5}
          aria-hidden="true"
          textAnchor="start"
        >
          270°
        </text>
      </svg>
      {legend && zones.length > 0 && (
        <figcaption className={styles.legend}>
          <ol>
            {zones.map((zone, index) => (
              <li
                key={`${zone.code}-${index}`}
                className={cx(zone.code === activeCode && styles.legendActive)}
              >
                <span className={styles.legendIndex} aria-hidden="true">
                  {index + 1}
                </span>
                <span className={styles.legendName}>
                  <span className="visually-hidden">{index + 1}. </span>
                  {zone.name || zone.code || 'sem nome'}
                </span>
                <span className={styles.legendSector}>{formatZoneSector(zone)}</span>
              </li>
            ))}
          </ol>
        </figcaption>
      )}
    </figure>
  )
}
