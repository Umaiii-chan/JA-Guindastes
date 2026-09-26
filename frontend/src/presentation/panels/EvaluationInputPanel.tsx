import { useId } from 'react'

export interface EvaluationInputPanelProps {
  readonly configurationId: string
  /** Texto do campo, como digitado (pode estar vazio ou inválido). */
  readonly loadWeightText: string
  onConfigurationIdChange(value: string): void
  onLoadWeightTextChange(value: string): void
}

/**
 * Configuração avaliada e peso da carga, enviados ao backend junto com o estado dos sliders.
 * A configuração é, por enquanto, um campo de texto: a lista depende dos cadastros (TASK-030).
 */
export function EvaluationInputPanel({
  configurationId,
  loadWeightText,
  onConfigurationIdChange,
  onLoadWeightTextChange,
}: EvaluationInputPanelProps) {
  const idPrefix = useId()
  const titleId = `${idPrefix}-title`
  const configurationInputId = `${idPrefix}-configuration`
  const loadInputId = `${idPrefix}-load`

  return (
    <section className="evaluation-input" aria-labelledby={titleId}>
      <h2 id={titleId}>Configuração e carga</h2>
      <div className="evaluation-input__field">
        <label htmlFor={configurationInputId}>Configuração (configuration_id)</label>
        <input
          id={configurationInputId}
          type="text"
          autoComplete="off"
          spellCheck={false}
          value={configurationId}
          onChange={(event) => onConfigurationIdChange(event.currentTarget.value)}
        />
      </div>
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
