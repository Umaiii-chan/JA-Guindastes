import {
  type FormErrors,
  SHEET_FIELD_KEYS,
  type SheetFieldKey,
  sheetFieldPath,
  type SheetFormValues,
} from '../../application/catalog/catalogForms'
import { Field, Input, Notice } from '../ui'
import styles from './panels.module.css'
import { SHEET_FIELD_LABELS } from './technicalSheetLabels'

export interface TechnicalSheetFieldsProps {
  readonly values: SheetFormValues
  /** Erros locais ou do backend (422), com as chaves `geometry` e `geometry.<campo>`. */
  readonly errors: FormErrors
  readonly disabled?: boolean
  onChange(key: SheetFieldKey, value: string): void
}

/** Campos da ficha técnica geométrica (ADR-013 C-4), cada um com o seu erro logo abaixo. */
export function TechnicalSheetFields({
  values,
  errors,
  disabled = false,
  onChange,
}: TechnicalSheetFieldsProps) {
  const sheetError = errors.geometry

  return (
    <fieldset className={styles.sheetFieldset} disabled={disabled}>
      <legend className={styles.legend}>Ficha técnica (ADR-013 C-4)</legend>
      {sheetError && (
        <Notice tone="danger" role="alert" compact>
          {sheetError}
        </Notice>
      )}
      <div className={styles.grid2}>
        {SHEET_FIELD_KEYS.map((key) => (
          <Field key={key} label={SHEET_FIELD_LABELS[key]} error={errors[sheetFieldPath(key)]}>
            <Input
              type="number"
              inputMode="decimal"
              step="any"
              value={values[key]}
              onChange={(event) => onChange(key, event.currentTarget.value)}
            />
          </Field>
        ))}
      </div>
    </fieldset>
  )
}
