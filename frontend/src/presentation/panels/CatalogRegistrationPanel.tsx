import { type FormEvent, type ReactNode, useId, useState } from 'react'

import type { CatalogMutationResult } from '../../application/catalog/CatalogBrowser'
import {
  EMPTY_SHEET_FORM,
  type FormErrors,
  formErrorsFromRequest,
  isConfigurationFormField,
  parseTechnicalSheet,
  type SheetFormValues,
  unshownFieldErrors,
  validateRequiredName,
} from '../../application/catalog/catalogForms'
import type {
  Crane,
  CraneConfiguration,
  CraneTechnicalSheet,
  Manufacturer,
} from '../../domain/catalog/catalog'
import { TechnicalSheetFields } from './TechnicalSheetFields'

export interface CatalogRegistrationPanelProps {
  /** Onde o guindaste novo é cadastrado; sem fabricante escolhido, o formulário fica desabilitado. */
  readonly selectedManufacturer: Manufacturer | null
  /** Onde a configuração nova é cadastrada. */
  readonly selectedCrane: Crane | null
  onCreateManufacturer(name: string): Promise<CatalogMutationResult<Manufacturer>>
  onCreateCrane(manufacturerId: string, modelName: string): Promise<CatalogMutationResult<Crane>>
  onCreateConfiguration(
    craneId: string,
    name: string,
    geometry: CraneTechnicalSheet | null,
  ): Promise<CatalogMutationResult<CraneConfiguration>>
}

/**
 * Cadastros simples do catálogo (TASK-030 no backend): fabricante, guindaste do fabricante escolhido e
 * configuração do guindaste escolhido, com a ficha técnica. O item criado fica escolhido na seleção.
 */
export function CatalogRegistrationPanel({
  selectedManufacturer,
  selectedCrane,
  onCreateManufacturer,
  onCreateCrane,
  onCreateConfiguration,
}: CatalogRegistrationPanelProps) {
  return (
    <details className="catalog-panel catalog-panel--registration">
      <summary>Cadastros (fabricante, guindaste, configuração)</summary>
      <p className="catalog-panel__notice">
        Enquanto a empresa não fornece as fichas reais, use só dados FICTÍCIOS (ADR-013 C-4).
      </p>
      <ManufacturerForm onCreate={onCreateManufacturer} />
      <CraneForm manufacturer={selectedManufacturer} onCreate={onCreateCrane} />
      <ConfigurationForm crane={selectedCrane} onCreate={onCreateConfiguration} />
    </details>
  )
}

interface SubmissionState {
  readonly submitting: boolean
  readonly errors: FormErrors
  /** Resumo do erro (ou `null`). */
  readonly message: string | null
  readonly success: string | null
}

const IDLE_SUBMISSION: SubmissionState = {
  submitting: false,
  errors: {},
  message: null,
  success: null,
}

/** Envia o cadastro e guarda o estado do envio. `run` devolve `true` se gravou. */
function useSubmission() {
  const [state, setState] = useState<SubmissionState>(IDLE_SUBMISSION)

  async function run<T>(
    localErrors: FormErrors | null,
    send: () => Promise<CatalogMutationResult<T>>,
    successMessage: string,
  ): Promise<boolean> {
    if (localErrors && Object.keys(localErrors).length > 0) {
      setState({ ...IDLE_SUBMISSION, errors: localErrors, message: 'Corrija os campos indicados.' })
      return false
    }
    setState({ ...IDLE_SUBMISSION, submitting: true })
    const result = await send()
    if (result.ok) {
      setState({ ...IDLE_SUBMISSION, success: successMessage })
      return true
    }
    const { fieldErrors, message } = formErrorsFromRequest(result.error)
    setState({ ...IDLE_SUBMISSION, errors: fieldErrors, message })
    return false
  }

  return { state, run }
}

function FormFeedback({
  state,
  unshown,
}: {
  readonly state: SubmissionState
  readonly unshown: readonly string[]
}) {
  return (
    <>
      {state.message && (
        <div className="catalog-form__error" role="alert">
          <p>{state.message}</p>
          {unshown.length > 0 && (
            <ul>
              {unshown.map((text) => (
                <li key={text}>{text}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {state.success && (
        <p className="catalog-form__success" role="status">
          {state.success}
        </p>
      )}
    </>
  )
}

function NameField({
  label,
  value,
  error,
  onChange,
}: {
  readonly label: string
  readonly value: string
  readonly error: string | undefined
  onChange(value: string): void
}) {
  const inputId = useId()
  const errorId = `${inputId}-error`
  return (
    <div className="catalog-form__field">
      <label htmlFor={inputId}>{label}</label>
      <input
        id={inputId}
        type="text"
        autoComplete="off"
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
      {error && (
        <span className="catalog-form__field-error" id={errorId}>
          {error}
        </span>
      )}
    </div>
  )
}

function CatalogForm({
  title,
  hint,
  disabled,
  submitting,
  onSubmit,
  children,
}: {
  readonly title: string
  readonly hint: string
  readonly disabled: boolean
  readonly submitting: boolean
  onSubmit(): void
  readonly children: ReactNode
}) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSubmit()
  }
  return (
    <form className="catalog-form" onSubmit={handleSubmit} noValidate>
      <h3>{title}</h3>
      <p className="catalog-form__hint">{hint}</p>
      <fieldset className="catalog-form__body" disabled={disabled || submitting}>
        {children}
        <button type="submit">{submitting ? 'Cadastrando…' : 'Cadastrar'}</button>
      </fieldset>
    </form>
  )
}

function ManufacturerForm({
  onCreate,
}: {
  onCreate(name: string): Promise<CatalogMutationResult<Manufacturer>>
}) {
  const [name, setName] = useState('')
  const { state, run } = useSubmission()

  const submit = async () => {
    const nameError = validateRequiredName(name)
    const saved = await run(
      nameError ? { name: nameError } : null,
      () => onCreate(name.trim()),
      `Fabricante "${name.trim()}" cadastrado e escolhido.`,
    )
    if (saved) setName('')
  }

  return (
    <CatalogForm
      title="Novo fabricante"
      hint="O id é gerado pelo servidor."
      disabled={false}
      submitting={state.submitting}
      onSubmit={() => void submit()}
    >
      <NameField
        label="Nome do fabricante"
        value={name}
        error={state.errors.name}
        onChange={setName}
      />
      <FormFeedback state={state} unshown={unshownFieldErrors(state.errors, (f) => f === 'name')} />
    </CatalogForm>
  )
}

function CraneForm({
  manufacturer,
  onCreate,
}: {
  readonly manufacturer: Manufacturer | null
  onCreate(manufacturerId: string, modelName: string): Promise<CatalogMutationResult<Crane>>
}) {
  const [modelName, setModelName] = useState('')
  const { state, run } = useSubmission()

  const submit = async () => {
    if (!manufacturer) return
    const nameError = validateRequiredName(modelName)
    const saved = await run(
      nameError ? { modelName: nameError } : null,
      () => onCreate(manufacturer.id, modelName.trim()),
      `Guindaste "${modelName.trim()}" cadastrado e escolhido.`,
    )
    if (saved) setModelName('')
  }

  return (
    <CatalogForm
      title="Novo guindaste"
      hint={
        manufacturer
          ? `Fabricante: ${manufacturer.name}.`
          : 'Escolha um fabricante na seleção para cadastrar um guindaste nele.'
      }
      disabled={manufacturer === null}
      submitting={state.submitting}
      onSubmit={() => void submit()}
    >
      <NameField
        label="Modelo do guindaste"
        value={modelName}
        error={state.errors.modelName}
        onChange={setModelName}
      />
      <FormFeedback
        state={state}
        unshown={unshownFieldErrors(state.errors, (f) => f === 'modelName')}
      />
    </CatalogForm>
  )
}

function ConfigurationForm({
  crane,
  onCreate,
}: {
  readonly crane: Crane | null
  onCreate(
    craneId: string,
    name: string,
    geometry: CraneTechnicalSheet | null,
  ): Promise<CatalogMutationResult<CraneConfiguration>>
}) {
  const [name, setName] = useState('')
  const [withSheet, setWithSheet] = useState(true)
  const [sheetValues, setSheetValues] = useState<SheetFormValues>(EMPTY_SHEET_FORM)
  const { state, run } = useSubmission()
  const checkboxId = useId()

  const submit = async () => {
    if (!crane) return
    const errors: Record<string, string> = {}
    const nameError = validateRequiredName(name)
    if (nameError) errors.name = nameError
    let sheet: CraneTechnicalSheet | null = null
    if (withSheet) {
      const parsed = parseTechnicalSheet(sheetValues)
      if (parsed.errors) Object.assign(errors, parsed.errors)
      else sheet = parsed.sheet
    }
    const saved = await run(
      errors,
      () => onCreate(crane.id, name.trim(), sheet),
      `Configuração "${name.trim()}" cadastrada e escolhida.`,
    )
    if (saved) {
      setName('')
      setSheetValues(EMPTY_SHEET_FORM)
    }
  }

  return (
    <CatalogForm
      title="Nova configuração"
      hint={
        crane
          ? `Guindaste: ${crane.modelName}.`
          : 'Escolha um guindaste na seleção para cadastrar uma configuração nele.'
      }
      disabled={crane === null}
      submitting={state.submitting}
      onSubmit={() => void submit()}
    >
      <NameField
        label="Nome da configuração"
        value={name}
        error={state.errors.name}
        onChange={setName}
      />
      <div className="catalog-form__check">
        <input
          id={checkboxId}
          type="checkbox"
          checked={withSheet}
          onChange={(event) => setWithSheet(event.currentTarget.checked)}
        />
        <label htmlFor={checkboxId}>
          Com ficha técnica (sem ela, a avaliação responde “não avaliável”)
        </label>
      </div>
      {withSheet && (
        <TechnicalSheetFields
          values={sheetValues}
          errors={state.errors}
          onChange={(key, value) => setSheetValues((current) => ({ ...current, [key]: value }))}
        />
      )}
      <FormFeedback
        state={state}
        unshown={unshownFieldErrors(
          state.errors,
          (field) => isConfigurationFormField(field) && (withSheet || field === 'name'),
        )}
      />
    </CatalogForm>
  )
}
