import { ChevronDown, CircleAlert } from 'lucide-react'
import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  useId,
  useMemo,
} from 'react'

import { cx } from './cx'
import styles from './Field.module.css'
import { FieldContext, useFieldControl } from './fieldContext'

export interface FieldProps {
  readonly label: ReactNode
  /** Texto de ajuda sob o controle. */
  readonly hint?: ReactNode
  /** Mensagem de erro; marca o controle como inválido (`aria-invalid`) e o descreve. */
  readonly error?: ReactNode
  readonly required?: boolean
  /** Id do controle; gerado quando ausente. */
  readonly id?: string
  /** Conteúdo à direita do rótulo (ex.: valor atual, link). */
  readonly labelAside?: ReactNode
  readonly className?: string
  readonly children: ReactNode
}

/**
 * Campo de formulário: rótulo, controle, ajuda e erro, com os ids ligados (`htmlFor`,
 * `aria-describedby`, `aria-invalid`) para o `Input` ou `Select` dentro dele.
 */
export function Field({
  label,
  hint,
  error,
  required = false,
  id,
  labelAside,
  className,
  children,
}: FieldProps) {
  const generatedId = useId()
  const controlId = id ?? generatedId
  const hintId = `${controlId}-hint`
  const errorId = `${controlId}-error`
  const hasError = error !== undefined && error !== null && error !== false && error !== ''
  const describedBy =
    [hasError ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined

  const context = useMemo(
    () => ({ id: controlId, describedBy, invalid: hasError, required }),
    [controlId, describedBy, hasError, required],
  )

  return (
    <div className={cx(styles.field, hasError && styles.hasError, className)}>
      <div className={styles.labelRow}>
        <label className={styles.label} htmlFor={controlId}>
          {label}
          {required && (
            <span className={styles.required} aria-hidden="true">
              *
            </span>
          )}
        </label>
        {labelAside && <span className={styles.labelAside}>{labelAside}</span>}
      </div>
      <FieldContext.Provider value={context}>{children}</FieldContext.Provider>
      {hasError && (
        <p className={styles.error} id={errorId}>
          <CircleAlert size={13} aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
      {hint && (
        <p className={styles.hint} id={hintId}>
          {hint}
        </p>
      )}
    </div>
  )
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Unidade mostrada dentro do campo, à direita (ex.: `kg`, `m`). */
  readonly unit?: string
  /** Ícone à esquerda. */
  readonly leadingIcon?: ReactNode
}

/** Campo de texto ou número. Dentro de um `Field`, recebe os ids e o estado de erro dele. */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { unit, leadingIcon, className, id, required, ...rest },
  ref,
) {
  const control = useFieldControl({
    id,
    required,
    'aria-describedby': rest['aria-describedby'],
    'aria-invalid': rest['aria-invalid'],
  })
  return (
    <div
      className={cx(
        styles.control,
        unit && styles.withUnit,
        leadingIcon !== undefined && styles.withIcon,
        className,
      )}
    >
      {leadingIcon && (
        <span className={styles.leadingIcon} aria-hidden="true">
          {leadingIcon}
        </span>
      )}
      <input ref={ref} className={styles.input} {...rest} {...control} />
      {unit && (
        <span className={styles.unit} aria-hidden="true">
          {unit}
        </span>
      )}
    </div>
  )
})

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>

/** Lista de escolha nativa com o visual do tema. Dentro de um `Field`, recebe os ids dele. */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, id, required, children, ...rest },
  ref,
) {
  const control = useFieldControl({
    id,
    required,
    'aria-describedby': rest['aria-describedby'],
    'aria-invalid': rest['aria-invalid'],
  })
  return (
    <div className={cx(styles.control, styles.selectControl, className)}>
      <select ref={ref} className={cx(styles.input, styles.select)} {...rest} {...control}>
        {children}
      </select>
      <span className={styles.chevron} aria-hidden="true">
        <ChevronDown size={16} />
      </span>
    </div>
  )
})
