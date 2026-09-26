import { useId } from 'react'

import {
  type FormErrors,
  SHEET_FIELD_KEYS,
  type SheetFieldKey,
  sheetFieldPath,
  type SheetFormValues,
} from '../../application/catalog/catalogForms'
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
  const idPrefix = useId()
  const sheetError = errors.geometry

  return (
    <fieldset className="catalog-form__sheet" disabled={disabled}>
      <legend>Ficha técnica (ADR-013 C-4)</legend>
      {sheetError && (
        <p className="catalog-form__error" role="alert">
          {sheetError}
        </p>
      )}
      {SHEET_FIELD_KEYS.map((key) => {
        const inputId = `${idPrefix}-${key}`
        const errorId = `${inputId}-error`
        const error = errors[sheetFieldPath(key)]
        return (
          <div className="catalog-form__field" key={key}>
            <label htmlFor={inputId}>{SHEET_FIELD_LABELS[key]}</label>
            <input
              id={inputId}
              type="number"
              inputMode="decimal"
              step="any"
              value={values[key]}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              onChange={(event) => onChange(key, event.currentTarget.value)}
            />
            {error && (
              <span className="catalog-form__field-error" id={errorId}>
                {error}
              </span>
            )}
          </div>
        )
      })}
    </fieldset>
  )
}
