import { useId } from 'react'

import type { CraneLimits, CraneState } from '../../three/crane/types'

export type CraneControlKey = keyof CraneState

interface CraneControlPanelProps {
  /** `null` enquanto a cena não montou: os controles ficam desabilitados. */
  limits: CraneLimits | null
  state: CraneState | null
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
  { key: 'turretRotationDeg', label: 'Giro da torre', unit: '°', step: 1, fractionDigits: 0 },
  { key: 'boomAngleDeg', label: 'Inclinação da lança', unit: '°', step: 1, fractionDigits: 0 },
  { key: 'boomLengthM', label: 'Comprimento da lança', unit: ' m', step: 0.1, fractionDigits: 1 },
  { key: 'cableLengthM', label: 'Comprimento do cabo', unit: ' m', step: 0.1, fractionDigits: 1 },
]

function format(value: number, control: ControlDefinition): string {
  const number = value.toLocaleString('pt-BR', {
    minimumFractionDigits: control.fractionDigits,
    maximumFractionDigits: control.fractionDigits,
  })
  return `${number}${control.unit}`
}

/** Sliders dos comandos do guindaste. Mostra o valor aplicado pela cena (já limitado aos limites). */
export function CraneControlPanel({ limits, state, onChange }: CraneControlPanelProps) {
  const idPrefix = useId()
  const titleId = `${idPrefix}-title`

  return (
    <section className="crane-panel" aria-labelledby={titleId}>
      <h2 id={titleId}>Controles do guindaste</h2>
      <p className="crane-panel__notice">
        Guindaste provisório com medidas e limites FICTÍCIOS. Sem cálculo de capacidade.
      </p>
      {CONTROLS.map((control) => {
        const inputId = `${idPrefix}-${control.key}`
        const range = limits?.[control.key]
        const value = state?.[control.key]
        return (
          <div className="crane-panel__control" key={control.key}>
            <div className="crane-panel__label-row">
              <label htmlFor={inputId}>{control.label}</label>
              <output htmlFor={inputId}>
                {value === undefined ? '—' : format(value, control)}
              </output>
            </div>
            <input
              id={inputId}
              type="range"
              min={range?.min}
              max={range?.max}
              step={control.step}
              value={value ?? 0}
              disabled={range === undefined || value === undefined}
              onChange={(event) => onChange(control.key, event.currentTarget.valueAsNumber)}
            />
            {range && (
              <div className="crane-panel__range">
                <span>{format(range.min, control)}</span>
                <span>{format(range.max, control)}</span>
              </div>
            )}
          </div>
        )
      })}
    </section>
  )
}
