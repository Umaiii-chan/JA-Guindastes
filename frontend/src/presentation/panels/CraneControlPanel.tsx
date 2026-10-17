import { Info } from 'lucide-react'

import type { CraneLimits, CraneState } from '../../three/crane/types'
import { Slider } from '../ui'
import styles from './panels.module.css'

export type CraneControlKey = keyof CraneState

interface CraneControlPanelProps {
  /** `null` enquanto a cena não montou: os controles ficam desabilitados. */
  limits: CraneLimits | null
  state: CraneState | null
  /** De onde vêm os limites e os parâmetros a/h (ficha técnica ou FICTÍCIOS; TASK-033). */
  notice: string
  /** Observação por controle quando o limite não veio da ficha (ex.: cabo máximo FICTÍCIO). */
  notes?: Readonly<Partial<Record<CraneControlKey, string>>>
  onChange: (key: CraneControlKey, value: number) => void
}

interface ControlDefinition {
  readonly key: CraneControlKey
  readonly label: string
  readonly unit: string
  readonly step: number
  readonly fractionDigits: number
}

const CONTROLS: readonly ControlDefinition[] = [
  {
    key: 'turretRotationDeg',
    label: 'Giro da torre',
    unit: '°',
    step: 1,
    fractionDigits: 0,
  },
  {
    key: 'boomAngleDeg',
    label: 'Inclinação da lança',
    unit: '°',
    step: 1,
    fractionDigits: 0,
  },
  {
    key: 'boomLengthM',
    label: 'Comprimento da lança',
    unit: ' m',
    step: 0.1,
    fractionDigits: 1,
  },
  {
    key: 'cableLengthM',
    label: 'Comprimento do cabo',
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
}: CraneControlPanelProps) {
  const continuousTurret = limits?.turretRotationDeg.continuous === true
  return (
    <section className={styles.stack} aria-label="Controles do guindaste">
      <p className={styles.sourceNote}>
        <Info size={13} aria-hidden="true" />
        <span>{notice}</span>
      </p>
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
            onChange={(value) => onChange(control.key, value)}
          />
        )
      })}
    </section>
  )
}
