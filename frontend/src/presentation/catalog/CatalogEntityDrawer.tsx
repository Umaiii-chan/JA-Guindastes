import { CopyPlus, Plus } from 'lucide-react'
import { type FormEvent, useId, useState } from 'react'

import type { CatalogMutationResult } from '../../application/catalog/CatalogBrowser'
import {
  EMPTY_SHEET_FORM,
  type FormErrors,
  formErrorsFromRequest,
  isConfigurationFormField,
  parseTechnicalSheet,
  SHEET_FIELD_KEYS,
  sheetFieldPath,
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
import { TechnicalSheetFields } from '../panels/TechnicalSheetFields'
import { Button, Drawer, Field, Input, Notice } from '../ui'
import styles from './catalog.module.css'

/** O que o Drawer cadastra: um item novo, ou uma cópia editada de um existente. */
export type CatalogDrawerRequest =
  | { readonly entity: 'manufacturer'; readonly editing?: Manufacturer }
  | { readonly entity: 'crane'; readonly manufacturer: Manufacturer; readonly editing?: Crane }
  | {
      readonly entity: 'configuration'
      readonly crane: Crane
      readonly editing?: CraneConfiguration
    }

export interface CatalogMutations {
  onCreateManufacturer(name: string): Promise<CatalogMutationResult<Manufacturer>>
  onCreateCrane(manufacturerId: string, modelName: string): Promise<CatalogMutationResult<Crane>>
  onCreateConfiguration(
    craneId: string,
    name: string,
    geometry: CraneTechnicalSheet | null,
  ): Promise<CatalogMutationResult<CraneConfiguration>>
}

export interface CatalogEntityDrawerProps extends CatalogMutations {
  /** `null` fecha o Drawer. */
  readonly request: CatalogDrawerRequest | null
  onClose(): void
  /** Depois de gravar (o item criado já fica escolhido na seleção). */
  onSaved(): void
}

const NOUN = {
  manufacturer: { title: 'fabricante', article: 'o', label: 'Nome do fabricante' },
  crane: { title: 'guindaste', article: 'o', label: 'Modelo do guindaste' },
  configuration: { title: 'configuração', article: 'a', label: 'Nome da configuração' },
} as const

/**
 * Cadastro em Drawer (CA-1), com validação no campo. O backend ainda não tem rota para alterar
 * cadastros (handoffs/TASK-042.md § 8): "Editar" abre o formulário preenchido e grava uma CÓPIA como
 * item novo, sem mudar o original.
 */
export function CatalogEntityDrawer({
  request,
  onClose,
  onSaved,
  ...mutations
}: CatalogEntityDrawerProps) {
  if (request === null) return null
  // `key`: cada abertura começa com o formulário limpo (ou preenchido com o item editado).
  const key = `${request.entity}-${request.editing?.id ?? 'novo'}`
  return (
    <EntityForm key={key} request={request} onClose={onClose} onSaved={onSaved} {...mutations} />
  )
}

function sheetToForm(sheet: CraneTechnicalSheet | null): SheetFormValues {
  if (sheet === null) return EMPTY_SHEET_FORM
  const values: Record<string, string> = {}
  for (const key of SHEET_FIELD_KEYS) values[key] = sheet[key] === null ? '' : String(sheet[key])
  return values as SheetFormValues
}

function initialName(request: CatalogDrawerRequest): string {
  switch (request.entity) {
    case 'manufacturer':
      return request.editing?.name ?? ''
    case 'crane':
      return request.editing?.modelName ?? ''
    case 'configuration':
      return request.editing?.name ?? ''
  }
}

function EntityForm({
  request,
  onClose,
  onSaved,
  onCreateManufacturer,
  onCreateCrane,
  onCreateConfiguration,
}: CatalogEntityDrawerProps & { readonly request: CatalogDrawerRequest }) {
  const formId = useId()
  const noun = NOUN[request.entity]
  const editing = request.editing !== undefined
  const editedConfiguration = request.entity === 'configuration' ? request.editing : undefined
  const nameField = request.entity === 'crane' ? 'modelName' : 'name'

  const [name, setName] = useState(() => initialName(request))
  const [nameTouched, setNameTouched] = useState(false)
  const [withSheet, setWithSheet] = useState(
    () => request.entity !== 'configuration' || editedConfiguration?.geometry !== null,
  )
  const [sheetValues, setSheetValues] = useState<SheetFormValues>(() =>
    sheetToForm(editedConfiguration?.geometry ?? null),
  )
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [backendErrors, setBackendErrors] = useState<FormErrors>({})
  const [message, setMessage] = useState<string | null>(null)

  // Validação local, recalculada a cada tecla (a que vale continua sendo a do backend).
  const nameError = validateRequiredName(name)
  const sheetResult =
    request.entity === 'configuration' && withSheet ? parseTechnicalSheet(sheetValues) : null
  const localErrors: Record<string, string> = {}
  if (nameError && (nameTouched || submitted)) localErrors[nameField] = nameError
  if (sheetResult?.errors) {
    for (const [field, error] of Object.entries(sheetResult.errors)) {
      const key = field.replace(/^geometry\./, '') as keyof SheetFormValues
      // Campo da ficha: mostra o erro assim que tem texto (ou depois de tentar gravar).
      if (submitted || (sheetValues[key] ?? '').trim() !== '') localErrors[field] = error
    }
  }
  const errors: FormErrors = { ...localErrors, ...backendErrors }

  const clearBackendError = (field: string) => {
    if (!(field in backendErrors)) return
    const next = { ...backendErrors }
    delete next[field]
    setBackendErrors(next)
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitted(true)
    setMessage(null)
    if (nameError || sheetResult?.errors) {
      setMessage('Corrija os campos indicados.')
      return
    }
    setSubmitting(true)
    const trimmed = name.trim()
    let result: CatalogMutationResult<unknown>
    switch (request.entity) {
      case 'manufacturer':
        result = await onCreateManufacturer(trimmed)
        break
      case 'crane':
        result = await onCreateCrane(request.manufacturer.id, trimmed)
        break
      case 'configuration':
        result = await onCreateConfiguration(request.crane.id, trimmed, sheetResult?.sheet ?? null)
        break
    }
    setSubmitting(false)
    if (result.ok) {
      onSaved()
      onClose()
      return
    }
    const { fieldErrors, message: summary } = formErrorsFromRequest(result.error)
    setBackendErrors(fieldErrors)
    setMessage(summary)
  }

  const parent =
    request.entity === 'crane'
      ? `Fabricante: ${request.manufacturer.name}.`
      : request.entity === 'configuration'
        ? `Guindaste: ${request.crane.modelName}.`
        : 'O id é gerado pelo servidor.'
  const unshown = unshownFieldErrors(backendErrors, (field) =>
    request.entity === 'configuration'
      ? isConfigurationFormField(field) && (withSheet || field === 'name')
      : field === nameField,
  )

  return (
    <Drawer
      open
      onClose={submitting ? () => undefined : onClose}
      width={request.entity === 'configuration' ? 560 : 440}
      title={editing ? `Editar ${noun.title}` : `Nov${noun.article} ${noun.title}`}
      description={parent}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form={formId}
            variant="primary"
            icon={editing ? <CopyPlus size={15} /> : <Plus size={15} />}
            loading={submitting}
          >
            {editing ? `Salvar como nov${noun.article} ${noun.title}` : 'Cadastrar'}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        className={styles.drawerForm}
        onSubmit={(event) => void submit(event)}
        noValidate
      >
        {editing && (
          <Notice tone="info" compact title="A edição grava uma cópia">
            O backend ainda não altera cadastros existentes. Ao salvar, {noun.article} {noun.title}{' '}
            é cadastrad{noun.article} como nov{noun.article} item, com os dados abaixo; o original
            continua como está.
          </Notice>
        )}
        <Notice tone="warning" compact>
          Enquanto a empresa não fornece as fichas reais, use só dados FICTÍCIOS (ADR-013 C-4).
        </Notice>
        <fieldset className={styles.drawerFieldset} disabled={submitting}>
          <Field label={noun.label} required error={errors[nameField]}>
            <Input
              type="text"
              autoComplete="off"
              autoFocus
              value={name}
              onChange={(event) => {
                setName(event.currentTarget.value)
                clearBackendError(nameField)
              }}
              onBlur={() => setNameTouched(true)}
            />
          </Field>
          {request.entity === 'configuration' && (
            <>
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
                  errors={errors}
                  onChange={(key, value) => {
                    setSheetValues((current) => ({ ...current, [key]: value }))
                    clearBackendError(sheetFieldPath(key))
                  }}
                />
              )}
            </>
          )}
        </fieldset>
        {message && (
          <Notice tone="danger" role="alert" compact title={message}>
            {unshown.length > 0 && (
              <ul className={styles.bullets}>
                {unshown.map((text) => (
                  <li key={text}>{text}</li>
                ))}
              </ul>
            )}
          </Notice>
        )}
      </form>
    </Drawer>
  )
}
