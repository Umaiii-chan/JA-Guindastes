import { Building2, CircleCheck, Construction, Plus, Settings2 } from 'lucide-react'
import { type FormEvent, type ReactNode, useState } from 'react'

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
import { Button, Field, Input, Notice, Panel, Tabs } from '../ui'
import styles from './panels.module.css'
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
    <Panel
      title="Cadastros"
      subtitle="Fabricante, guindaste e configuração com ficha técnica"
      icon={<Plus size={16} />}
    >
      <Notice tone="warning" compact>
        Enquanto a empresa não fornece as fichas reais, use só dados FICTÍCIOS (ADR-013 C-4).
      </Notice>
      <Tabs
        label="Tipo de cadastro"
        items={[
          {
            id: 'manufacturer',
            label: 'Fabricante',
            icon: <Building2 size={14} />,
            content: <ManufacturerForm onCreate={onCreateManufacturer} />,
          },
          {
            id: 'crane',
            label: 'Guindaste',
            icon: <Construction size={14} />,
            content: <CraneForm manufacturer={selectedManufacturer} onCreate={onCreateCrane} />,
          },
          {
            id: 'configuration',
            label: 'Configuração',
            icon: <Settings2 size={14} />,
            content: <ConfigurationForm crane={selectedCrane} onCreate={onCreateConfiguration} />,
          },
        ]}
      />
    </Panel>
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
        <Notice tone="danger" role="alert" compact title={state.message}>
          {unshown.length > 0 && (
            <ul className={styles.bullets}>
              {unshown.map((text) => (
                <li key={text}>{text}</li>
              ))}
            </ul>
          )}
        </Notice>
      )}
      {state.success && (
        <p className={styles.formStatusOk} role="status">
          <CircleCheck size={14} aria-hidden="true" />
          <span>{state.success}</span>
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
  return (
    <Field label={label} error={error} required>
      <Input
        type="text"
        autoComplete="off"
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </Field>
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
    <form className={styles.form} onSubmit={handleSubmit} noValidate aria-label={title}>
      <p className={styles.formHint}>{hint}</p>
      <fieldset className={styles.stack} disabled={disabled || submitting}>
        {children}
        <div className={styles.formActions}>
          <Button
            type="submit"
            variant="primary"
            icon={<Plus size={15} />}
            loading={submitting}
            disabled={disabled}
          >
            {submitting ? 'Cadastrando…' : 'Cadastrar'}
          </Button>
        </div>
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
      <label className={styles.check}>
        <input
          type="checkbox"
          checked={withSheet}
          onChange={(event) => setWithSheet(event.currentTarget.checked)}
        />
        <span>Com ficha técnica (sem ela, a avaliação responde “não avaliável”)</span>
      </label>
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
