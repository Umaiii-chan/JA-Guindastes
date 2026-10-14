import { CircleCheck, CircleDashed, Crosshair } from 'lucide-react'
import { useState } from 'react'

import {
  type LoadFormField,
  type LoadFormValues,
  validateLoadForm,
} from '../../application/load/loadForm'
import { Field, Input } from '../ui'
import styles from './panels.module.css'

export interface LoadPanelProps {
  readonly values: LoadFormValues
  onChange(values: LoadFormValues): void
}

interface FieldSpec {
  readonly field: LoadFormField
  readonly label: string
  readonly type: 'text' | 'number'
  readonly unit?: string
  readonly placeholder?: string
}

const DESCRIPTION: FieldSpec = {
  field: 'description',
  label: 'Descrição',
  type: 'text',
  placeholder: 'ex.: Viga metálica',
}
const WEIGHT: FieldSpec = { field: 'weightKg', label: 'Peso (kg)', type: 'number', unit: 'kg' }

const DIMENSION_FIELDS: readonly FieldSpec[] = [
  { field: 'lengthM', label: 'Comprimento (m)', type: 'number', unit: 'm' },
  { field: 'widthM', label: 'Largura (m)', type: 'number', unit: 'm' },
  { field: 'heightM', label: 'Altura (m)', type: 'number', unit: 'm' },
]

const CG_FIELDS: readonly FieldSpec[] = [
  { field: 'cgAlongLengthM', label: 'Ao longo do comprimento (m)', type: 'number', unit: 'm' },
  { field: 'cgAlongWidthM', label: 'Ao longo da largura (m)', type: 'number', unit: 'm' },
  { field: 'cgAlongHeightM', label: 'Ao longo da altura (m)', type: 'number', unit: 'm' },
]

/**
 * Carga da simulação (RF-011): descrição, peso, dimensões e centro de gravidade opcional, com as
 * validações PROVISÓRIAS do domínio (TASK-028). O peso de uma carga válida alimenta a avaliação.
 */
export function LoadPanel({ values, onChange }: LoadPanelProps) {
  const { load, problems } = validateLoadForm(values)
  const cgFilled = CG_FIELDS.some(({ field }) => values[field].trim() !== '')
  // O erro de um campo só aparece depois que a pessoa mexe nele (ou num campo do CG), para o
  // formulário vazio não abrir cheio de avisos.
  const [touched, setTouched] = useState<ReadonlySet<LoadFormField>>(() => new Set())
  const isCgField = (field: LoadFormField) => CG_FIELDS.some((spec) => spec.field === field)
  const visibleProblem = (field: LoadFormField) =>
    touched.has(field) || values[field].trim() !== '' || (cgFilled && isCgField(field))
      ? problems[field]
      : undefined

  const renderField = ({ field, label, type, unit, placeholder }: FieldSpec) => (
    <Field key={field} label={label} error={visibleProblem(field)}>
      <Input
        type={type}
        inputMode={type === 'number' ? 'decimal' : undefined}
        autoComplete="off"
        unit={unit}
        placeholder={placeholder}
        value={values[field]}
        onChange={(event) => onChange({ ...values, [field]: event.currentTarget.value })}
        onBlur={() => setTouched((current) => new Set(current).add(field))}
      />
    </Field>
  )

  return (
    <section className={styles.stack} aria-label="Carga">
      {renderField(DESCRIPTION)}
      {renderField(WEIGHT)}
      <div className={styles.grid3}>{DIMENSION_FIELDS.map(renderField)}</div>
      <details className={styles.disclosure} open={cgFilled || undefined}>
        <summary>
          <Crosshair size={14} aria-hidden="true" />
          Centro de gravidade (opcional, a partir do centro da carga)
        </summary>
        <fieldset className={styles.stack}>
          <legend className="visually-hidden">
            Centro de gravidade (opcional, a partir do centro da carga)
          </legend>
          {CG_FIELDS.map(renderField)}
        </fieldset>
      </details>
      <p className={load === null ? styles.formStatus : styles.formStatusOk} role="status">
        {load === null ? (
          <CircleDashed size={14} aria-hidden="true" />
        ) : (
          <CircleCheck size={14} aria-hidden="true" />
        )}
        <span>
          {load === null
            ? 'Carga incompleta ou inválida: a avaliação aguarda uma carga válida.'
            : `Carga válida: ${load.weightKg.toLocaleString('pt-BR')} kg vão para a avaliação.`}
        </span>
      </p>
    </section>
  )
}
