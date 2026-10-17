import { Info } from 'lucide-react'

import type { CraneLimits, CraneState } from '../../three/crane/types'
import { cx, Slider } from '../ui'
import styles from './panels.module.css'

export type CraneControlKey = keyof CraneState

interface CraneControlPanelProps {
  /** `null` enquanto a cena não montou: os controles ficam desabilitados. */
  limits: CraneLimits | null
  state: CraneState | null
  /**
   * De onde vêm os limites e os parâmetros a/h (ficha técnica ou FICTÍCIOS; TASK-033). Na barra de
   * comando (`variant="bar"`) a nota fica no passo Posição (`CraneControlNotice`).
   */
  notice?: string
  /** Observação por controle quando o limite não veio da ficha (ex.: cabo máximo FICTÍCIO). */
  notes?: Readonly<Partial<Record<CraneControlKey, string>>>
  onChange: (key: CraneControlKey, value: number) => void
  /**
   * `stack` (padrão): sliders empilhados, com os limites. `bar`: sliders compactos lado a lado, na
   * barra de comando do simulador (TASK-095).
   */
  variant?: 'stack' | 'bar'
}

interface ControlDefinition {
  readonly key: CraneControlKey
  readonly label: string
  /** Rótulo curto da barra de comando (parte do rótulo completo, que segue como nome acessível). */
  readonly short: string
  readonly unit: string
  readonly step: number
  readonly fractionDigits: number
}

const CONTROLS: readonly ControlDefinition[] = [
  {
    key: 'turretRotationDeg',
    label: 'Giro da torre',
    short: 'Giro',
    unit: '°',
    step: 1,
    fractionDigits: 0,
  },
  {
    key: 'boomAngleDeg',
    label: 'Inclinação da lança',
    short: 'Inclinação',
    unit: '°',
    step: 1,
    fractionDigits: 0,
  },
  {
    key: 'boomLengthM',
    label: 'Comprimento da lança',
    short: 'Lança',
    unit: ' m',
    step: 0.1,
    fractionDigits: 1,
  },
  {
    key: 'cableLengthM',
    label: 'Comprimento do cabo',
    short: 'Cabo',
    unit: ' m',
    step: 0.1,
    fractionDigits: 1,
  },
]

function format(value: number, control: ControlDefinition): string {
  const number = value.toLocaleString('pt-BR', {
    minimumFractionDigits: control.fractionDigits,
    maximumFractionDigits: control.fractionDigits,
  })
  return `${number}${control.unit}`
}

/**
 * Sliders dos comandos do guindaste. Mostra o valor aplicado pela cena (já limitado aos limites). Com
 * giro contínuo, o slider do giro continua de −180° a 180°, mas as setas nas pontas dão a volta e o
 * comando vai pelo menor ângulo (TASK-092).
 */
export function CraneControlPanel({
  limits,
  state,
  notice,
  notes = {},
  onChange,
  variant = 'stack',
}: CraneControlPanelProps) {
  const bar = variant === 'bar'
  const continuousTurret = limits?.turretRotationDeg.continuous === true
  return (
    <section
      className={cx(bar ? styles.controlBar : styles.stack)}
      aria-label="Controles do guindaste"
    >
      {!bar && notice !== undefined && (
        <p className={styles.sourceNote}>
          <Info size={13} aria-hidden="true" />
          <span>{notice}</span>
        </p>
      )}
      {CONTROLS.map((control) => {
        const range = limits?.[control.key]
        return (
          <Slider
            key={control.key}
            label={control.label}
            value={state?.[control.key]}
            min={range?.min}
            max={range?.max}
            step={control.step}
            format={(value) => format(value, control)}
            note={notes[control.key]}
            wraps={control.key === 'turretRotationDeg' && continuousTurret}
            compact={bar}
            shortLabel={bar ? control.short : undefined}
            className={bar ? styles.controlBarItem : undefined}
            onChange={(value) => onChange(control.key, value)}
          />
        )
      })}
    </section>
  )
}

/**
 * De onde vêm os limites dos controles e as observações de cada um (TASK-095): no passo Posição,
 * já que os sliders ficam na barra de comando, embaixo da cena.
 */
export function CraneControlNotice({
  notice,
  notes = {},
}: {
  readonly notice: string
  readonly notes?: Readonly<Partial<Record<CraneControlKey, string>>>
}) {
  const entries = CONTROLS.filter((control) => notes[control.key] !== undefined)
  return (
    <div className={styles.stack}>
      <p className={styles.sourceNote}>
        <Info size={13} aria-hidden="true" />
        <span>
          Gire a torre, incline e estenda a lança e ajuste o cabo pela barra de comando, embaixo da
          cena. {notice}
        </span>
      </p>
      {entries.length > 0 && (
        <ul className={styles.controlNotes}>
          {entries.map((control) => (
            <li key={control.key}>
              <strong>{control.label}:</strong> {notes[control.key]}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
