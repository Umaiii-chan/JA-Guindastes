import { createContext, useContext } from 'react'

/** O que o `Field` passa ao controle dentro dele: id do rótulo, descrição e se está inválido. */
export interface FieldControlContext {
  readonly id: string
  readonly describedBy: string | undefined
  readonly invalid: boolean
  readonly required: boolean
}

export const FieldContext = createContext<FieldControlContext | null>(null)

/**
 * Atributos de acessibilidade do controle: os do `Field` que o envolve, com o que o próprio controle
 * informar tendo prioridade.
 */
export function useFieldControl(own: {
  readonly id?: string
  readonly 'aria-describedby'?: string
  readonly 'aria-invalid'?: boolean | 'true' | 'false' | 'grammar' | 'spelling'
  readonly required?: boolean
}) {
  const field = useContext(FieldContext)
  const invalid = own['aria-invalid'] ?? (field?.invalid ? true : undefined)
  return {
    id: own.id ?? field?.id,
    'aria-describedby': own['aria-describedby'] ?? field?.describedBy,
    'aria-invalid': invalid,
    required: own.required ?? (field?.required || undefined),
  }
}
