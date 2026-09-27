import { formatZoneSector, zoneSpanDeg } from '../../application/catalog/rotationZones'
import type { RotationZone } from '../../domain/catalog/catalog'
import { cx } from '../ui'
import styles from './RotationZoneDiagram.module.css'

export interface RotationZoneDiagramProps {
  readonly zones: readonly RotationZone[]
  /** Zona destacada (ex.: a atual do simulador); `null` = nenhuma. */
  readonly activeCode?: string | null
  /** Lado do quadrado, em px. */
  readonly size?: number
  readonly className?: string
}

const DEG = Math.PI / 180
const VIEW = 100
const CENTER = VIEW / 2
const RADIUS = 38

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

/** Fatia de `start` a `end` no sentido anti-horário da tela (sweep-flag 0 no SVG). */
function sectorPath(zone: RotationZone): string {
  const span = zoneSpanDeg(zone)
  if (span === 0) return ''
  const from = pointAt(zone.startDeg)
  const to = pointAt(zone.endDeg)
  const largeArc = span > 180 ? 1 : 0
  return `M ${CENTER} ${CENTER} L ${round(from.x)} ${round(from.y)} A ${RADIUS} ${RADIUS} 0 ${largeArc} 0 ${round(to.x)} ${round(to.y)} Z`
}

/**
 * Diagrama pequeno dos setores das zonas de giro (TASK-046), visto de cima, com a frente do chassi
 * para cima. Só conferência visual do cadastro: a zona usada na avaliação é a do backend.
 */
export function RotationZoneDiagram({
  zones,
  activeCode = null,
  size = 120,
  className,
}: RotationZoneDiagramProps) {
  const label =
    zones.length === 0
      ? 'Sem zonas de giro: uma tabela vale para todo o giro.'
      : `Setores das zonas de giro, vistos de cima com a frente para cima: ${zones
          .map((zone) => `${zone.name} ${formatZoneSector(zone)}`)
          .join('; ')}.`
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
        <circle className={styles.base} cx={CENTER} cy={CENTER} r={RADIUS} />
        {zones.map((zone, index) =>
          zoneSpanDeg(zone) === 0 ? null : (
            <path
              key={`${zone.code}-${index}`}
              className={cx(styles.sector, zone.code === activeCode && styles.active)}
              data-tone={index % 4}
              d={sectorPath(zone)}
            />
          ),
        )}
        {zones.map((zone, index) => {
          const span = zoneSpanDeg(zone)
          if (span === 0) return null
          const at = pointAt(zone.startDeg + span / 2, RADIUS * 0.62)
          return (
            <text
              key={`label-${zone.code}-${index}`}
              className={styles.sectorLabel}
              x={round(at.x)}
              y={round(at.y)}
              aria-hidden="true"
            >
              {index + 1}
            </text>
          )
        })}
        {/* Frente do chassi (ψ = 0°) e o sentido do giro. */}
        <line
          className={styles.front}
          x1={CENTER}
          y1={CENTER}
          x2={CENTER}
          y2={CENTER - RADIUS - 6}
        />
        <text className={styles.axisLabel} x={CENTER} y={7} aria-hidden="true">
          frente 0°
        </text>
        <text
          className={styles.axisLabel}
          x={5}
          y={CENTER + 2}
          aria-hidden="true"
          textAnchor="start"
        >
          90°
        </text>
        <circle className={styles.pivot} cx={CENTER} cy={CENTER} r={2.5} />
      </svg>
      {zones.length > 0 && (
        <figcaption className={styles.legend}>
          <ol>
            {zones.map((zone, index) => (
              <li key={`${zone.code}-${index}`} data-tone={index % 4}>
                <span className={styles.swatch} aria-hidden="true" />
                <span className={styles.legendName}>
                  {index + 1}. {zone.name || zone.code || 'sem nome'}
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
