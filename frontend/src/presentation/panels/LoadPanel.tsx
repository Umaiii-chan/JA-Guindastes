import { useId } from 'react'

import {
  type LoadFormField,
  type LoadFormValues,
  validateLoadForm,
} from '../../application/load/loadForm'

export interface LoadPanelProps {
  readonly values: LoadFormValues
  onChange(values: LoadFormValues): void
}

interface FieldSpec {
  readonly field: LoadFormField
  readonly label: string
  readonly type: 'text' | 'number'
}

const MAIN_FIELDS: readonly FieldSpec[] = [
  { field: 'description', label: 'Descrição', type: 'text' },
  { field: 'weightKg', label: 'Peso (kg)', type: 'number' },
  { field: 'lengthM', label: 'Comprimento (m)', type: 'number' },
  { field: 'widthM', label: 'Largura (m)', type: 'number' },
  { field: 'heightM', label: 'Altura (m)', type: 'number' },
]

const CG_FIELDS: readonly FieldSpec[] = [
  { field: 'cgAlongLengthM', label: 'Ao longo do comprimento (m)', type: 'number' },
  { field: 'cgAlongWidthM', label: 'Ao longo da largura (m)', type: 'number' },
  { field: 'cgAlongHeightM', label: 'Ao longo da altura (m)', type: 'number' },
]

/**
 * Carga da simulação (RF-011): descrição, peso, dimensões e centro de gravidade opcional, com as
 * validações PROVISÓRIAS do domínio (TASK-028). O peso de uma carga válida alimenta a avaliação.
 */
export function LoadPanel({ values, onChange }: LoadPanelProps) {
  const idPrefix = useId()
  const titleId = `${idPrefix}-title`
  const { load, problems } = validateLoadForm(values)

  const renderField = ({ field, label, type }: FieldSpec) => {
    const inputId = `${idPrefix}-${field}`
    const problemId = `${inputId}-problem`
    const problem = problems[field]
    return (
      <div className="evaluation-input__field" key={field}>
        <label htmlFor={inputId}>{label}</label>
        <input
          id={inputId}
          type={type}
          inputMode={type === 'number' ? 'decimal' : undefined}
          autoComplete="off"
          value={values[field]}
          aria-invalid={problem !== undefined}
          aria-describedby={problem !== undefined ? problemId : undefined}
          onChange={(event) => onChange({ ...values, [field]: event.currentTarget.value })}
        />
        {problem !== undefined && (
          <span id={problemId} className="evaluation-panel__meta" role="alert">
            {problem}
          </span>
        )}
      </div>
    )
  }

  return (
    <section className="evaluation-input" aria-labelledby={titleId}>
      <h2 id={titleId}>Carga</h2>
      {MAIN_FIELDS.map(renderField)}
      <fieldset>
        <legend>Centro de gravidade (opcional, a partir do centro da carga)</legend>
        {CG_FIELDS.map(renderField)}
      </fieldset>
      <p className="evaluation-panel__meta">
        {load === null
          ? 'Carga incompleta ou inválida: a avaliação aguarda uma carga válida.'
          : `Carga válida: ${load.weightKg.toLocaleString('pt-BR')} kg vão para a avaliação.`}
      </p>
      <p className="evaluation-panel__meta">
        Validações provisórias (TASK-028): peso &gt; 0, dimensões &gt; 0 e centro de gravidade
        dentro da caixa.
      </p>
    </section>
  )
}
