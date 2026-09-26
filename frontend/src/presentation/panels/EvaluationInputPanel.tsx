import { useId } from 'react'

export interface EvaluationInputPanelProps {
  /** Texto do campo, como digitado (pode estar vazio ou inválido). */
  readonly loadWeightText: string
  onLoadWeightTextChange(value: string): void
}

/**
 * Peso da carga, enviado ao backend junto com o estado dos sliders e a configuração escolhida no
 * painel do catálogo (a configuração deixou de ser um campo de texto na TASK-033).
 */
export function EvaluationInputPanel({
  loadWeightText,
  onLoadWeightTextChange,
}: EvaluationInputPanelProps) {
  const idPrefix = useId()
  const titleId = `${idPrefix}-title`
  const loadInputId = `${idPrefix}-load`

  return (
    <section className="evaluation-input" aria-labelledby={titleId}>
      <h2 id={titleId}>Carga</h2>
      <div className="evaluation-input__field">
        <label htmlFor={loadInputId}>Peso da carga (kg)</label>
        <input
          id={loadInputId}
          type="number"
          inputMode="decimal"
          min={0}
          step={100}
          value={loadWeightText}
          onChange={(event) => onLoadWeightTextChange(event.currentTarget.value)}
        />
      </div>
    </section>
  )
}
