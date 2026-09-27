import { Plus, Save } from 'lucide-react'
import { type FormEvent, useId, useState } from 'react'

import type { CatalogMutationResult } from '../../application/catalog/CatalogBrowser'
import {
  configurationChanges,
  EMPTY_SHEET_FORM,
  type FormErrors,
  formErrorsFromRequest,
  isConfigurationFormField,
  isEmptyConfigurationChanges,
  isZoneOrHookField,
  parseTechnicalSheet,
  SHEET_FIELD_KEYS,
  sheetFieldPath,
  type SheetFormValues,
  unshownFieldErrors,
  validateRequiredName,
  type ZoneAndHookValues,
} from '../../application/catalog/catalogForms'
import type { ConfigurationChanges } from '../../application/catalog/ports'
import {
  parseHookBlockWeight,
  parseZoneRows,
  type ZoneFormRow,
  type ZoneRowField,
  zoneRowsFrom,
  ZONES_FIELD,
} from '../../application/catalog/rotationZones'
import { ROTATION_ZONE_IN_USE } from '../../domain/catalog/catalog'
import type {
  Crane,
  CraneConfiguration,
  CraneTechnicalSheet,
  Manufacturer,
} from '../../domain/catalog/catalog'
import { TechnicalSheetFields } from '../panels/TechnicalSheetFields'
import { Button, Dialog, Drawer, Field, Input, Notice, useToast } from '../ui'
import styles from './catalog.module.css'
import { RotationZonesEditor } from './RotationZonesEditor'

/** O que o Drawer faz: cadastra um item novo, ou altera um existente (`editing`). */
export type CatalogDrawerRequest =
  | { readonly entity: 'manufacturer'; readonly editing?: Manufacturer }
  | { readonly entity: 'crane'; readonly manufacturer: Manufacturer; readonly editing?: Crane }
  | {
      readonly entity: 'configuration'
      readonly crane: Crane
      readonly editing?: CraneConfiguration
      /**
       * Versão da tabela ativa da configuração editada: `null` = não tem; ausente = não se sabe
       * (lista carregando ou com erro). Com tabela ativa (ou sem saber), mudar a ficha pede
       * confirmação.
       */
      readonly activeChartVersion?: string | null
    }

export interface CatalogMutations {
  onCreateManufacturer(name: string): Promise<CatalogMutationResult<Manufacturer>>
  onCreateCrane(manufacturerId: string, modelName: string): Promise<CatalogMutationResult<Crane>>
  onCreateConfiguration(
    craneId: string,
    name: string,
    geometry: CraneTechnicalSheet | null,
    extras?: ZoneAndHookValues,
  ): Promise<CatalogMutationResult<CraneConfiguration>>
  onUpdateManufacturer(
    manufacturerId: string,
    name: string,
  ): Promise<CatalogMutationResult<Manufacturer>>
  onUpdateCrane(craneId: string, modelName: string): Promise<CatalogMutationResult<Crane>>
  onUpdateConfiguration(
    configurationId: string,
    changes: ConfigurationChanges,
  ): Promise<CatalogMutationResult<CraneConfiguration>>
}

export interface CatalogEntityDrawerProps extends CatalogMutations {
  /** `null` fecha o Drawer. */
  readonly request: CatalogDrawerRequest | null
  onClose(): void
  /** Depois de gravar (o item criado já fica escolhido na seleção), ou quando o item sumiu (404). */
  onSaved(): void
}

const NOUN = {
  manufacturer: { title: 'fabricante', article: 'o', label: 'Nome do fabricante' },
  crane: { title: 'guindaste', article: 'o', label: 'Modelo do guindaste' },
  configuration: { title: 'configuração', article: 'a', label: 'Nome da configuração' },
} as const

/**
 * Cadastro e alteração em Drawer (CA-1 da TASK-042; CA-5 da TASK-044), com validação no campo.
 * "Editar" grava no próprio item (`PATCH`). Mudar a ficha técnica de uma configuração com tabela
 * ativa pede confirmação num Dialog: as avaliações seguintes mudam.
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

type SavePlan =
  | { readonly kind: 'none' }
  | { readonly kind: 'run'; readonly run: () => Promise<CatalogMutationResult<unknown>> }
  | { readonly kind: 'confirm-sheet'; readonly changes: ConfigurationChanges }

function EntityForm({
  request,
  onClose,
  onSaved,
  onCreateManufacturer,
  onCreateCrane,
  onCreateConfiguration,
  onUpdateManufacturer,
  onUpdateCrane,
  onUpdateConfiguration,
}: CatalogEntityDrawerProps & { readonly request: CatalogDrawerRequest }) {
  const formId = useId()
  const toast = useToast()
  const noun = NOUN[request.entity]
  const editing = request.editing !== undefined
  const editedConfiguration = request.entity === 'configuration' ? request.editing : undefined
  // A alteração não remove a ficha (o backend não aceita `geometry: null`): quem tem, mantém.
  const sheetLocked = editedConfiguration !== undefined && editedConfiguration.geometry !== null
  const nameField = request.entity === 'crane' ? 'modelName' : 'name'

  const [name, setName] = useState(() => initialName(request))
  const [nameTouched, setNameTouched] = useState(false)
  const [withSheet, setWithSheet] = useState(
    () => request.entity !== 'configuration' || editedConfiguration?.geometry !== null,
  )
  const [sheetValues, setSheetValues] = useState<SheetFormValues>(() =>
    sheetToForm(editedConfiguration?.geometry ?? null),
  )
  const [zoneRows, setZoneRows] = useState<readonly ZoneFormRow[]>(() =>
    zoneRowsFrom(editedConfiguration?.rotationZones ?? []),
  )
  const [hookText, setHookText] = useState(() =>
    editedConfiguration?.hookBlockWeightKg === null ||
    editedConfiguration?.hookBlockWeightKg === undefined
      ? ''
      : String(editedConfiguration.hookBlockWeightKg),
  )
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [backendErrors, setBackendErrors] = useState<FormErrors>({})
  const [message, setMessage] = useState<string | null>(null)
  /**
   * Alteração da ficha, das zonas ou do gancho esperando a confirmação (o Drawer some enquanto o
   * Dialog está aberto).
   */
  const [pendingSheet, setPendingSheet] = useState<ConfigurationChanges | null>(null)

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
  // Zonas de giro e gancho (TASK-046): só na configuração.
  const isConfiguration = request.entity === 'configuration'
  const zoneResult = isConfiguration ? parseZoneRows(zoneRows) : null
  const hookResult = isConfiguration ? parseHookBlockWeight(hookText) : null
  if (zoneResult?.errors) {
    for (const [field, error] of Object.entries(zoneResult.errors)) {
      const match = /^rotationZones\.(\d+)\.(code|name|startDeg|endDeg)$/.exec(field)
      const typed = match
        ? (zoneRows[Number(match[1])]?.[match[2] as ZoneRowField] ?? '').trim() !== ''
        : true
      // Cobertura (o todo) sempre; campo da zona, assim que tem texto ou depois de tentar gravar.
      if (submitted || typed) localErrors[field] = error
    }
  }
  if (hookResult?.error) localErrors.hookBlockWeightKg = hookResult.error
  const errors: FormErrors = { ...localErrors, ...backendErrors }

  const clearBackendError = (field: string) => {
    if (!(field in backendErrors)) return
    const next = { ...backendErrors }
    delete next[field]
    setBackendErrors(next)
  }

  /** Qualquer mudança nas zonas limpa os erros do backend sobre elas (o todo e os campos). */
  const changeZoneRows = (rows: readonly ZoneFormRow[]) => {
    setZoneRows(rows)
    if (!Object.keys(backendErrors).some((field) => field.startsWith(ZONES_FIELD))) return
    setBackendErrors(
      Object.fromEntries(
        Object.entries(backendErrors).filter(([field]) => !field.startsWith(ZONES_FIELD)),
      ),
    )
  }

  /** O que salvar: cadastrar, alterar, pedir confirmação da ficha ou nada (nada mudou). */
  const planSave = (
    trimmed: string,
    sheet: CraneTechnicalSheet | null,
    extras: ZoneAndHookValues,
  ): SavePlan => {
    switch (request.entity) {
      case 'manufacturer': {
        const original = request.editing
        if (!original) return { kind: 'run', run: () => onCreateManufacturer(trimmed) }
        if (trimmed === original.name) return { kind: 'none' }
        return { kind: 'run', run: () => onUpdateManufacturer(original.id, trimmed) }
      }
      case 'crane': {
        const original = request.editing
        const manufacturerId = request.manufacturer.id
        if (!original) return { kind: 'run', run: () => onCreateCrane(manufacturerId, trimmed) }
        if (trimmed === original.modelName) return { kind: 'none' }
        return { kind: 'run', run: () => onUpdateCrane(original.id, trimmed) }
      }
      case 'configuration': {
        const original = request.editing
        const craneId = request.crane.id
        if (!original) {
          return {
            kind: 'run',
            run: () => onCreateConfiguration(craneId, trimmed, sheet, extras),
          }
        }
        const changes = configurationChanges(original, trimmed, sheet, extras)
        if (isEmptyConfigurationChanges(changes)) return { kind: 'none' }
        // Ficha, zonas e gancho mudam as avaliações seguintes: com tabela ativa, confirma.
        const changesEvaluation =
          changes.geometry !== undefined ||
          changes.rotationZones !== undefined ||
          changes.hookBlockWeightKg !== undefined
        if (changesEvaluation && request.activeChartVersion !== null) {
          return { kind: 'confirm-sheet', changes }
        }
        return { kind: 'run', run: () => onUpdateConfiguration(original.id, changes) }
      }
    }
  }

  const save = async (run: () => Promise<CatalogMutationResult<unknown>>) => {
    setSubmitting(true)
    const result = await run()
    setSubmitting(false)
    setPendingSheet(null)
    if (result.ok) {
      onSaved()
      onClose()
      return
    }
    if (editing && result.error.code === 'NOT_FOUND') {
      // O item sumiu (outra pessoa, outra aba): avisa, fecha e relê o catálogo.
      toast.show({
        tone: 'danger',
        title: `${noun.article === 'a' ? 'A' : 'O'} ${noun.title} não existe mais`,
        description: result.error.message,
      })
      onSaved()
      onClose()
      return
    }
    const { fieldErrors, message: summary } = formErrorsFromRequest(result.error)
    // 409 ROTATION_ZONE_IN_USE (TASK-046): o problema é da lista de zonas; mostra no editor também.
    setBackendErrors(
      result.error.apiCode === ROTATION_ZONE_IN_USE
        ? { ...fieldErrors, [ZONES_FIELD]: result.error.message }
        : fieldErrors,
    )
    setMessage(summary)
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitted(true)
    setMessage(null)
    if (nameError || sheetResult?.errors || zoneResult?.errors || hookResult?.error) {
      setMessage('Corrija os campos indicados.')
      return
    }
    const extras: ZoneAndHookValues = isConfiguration
      ? { rotationZones: zoneResult?.zones ?? [], hookBlockWeightKg: hookResult?.value ?? null }
      : {}
    const plan = planSave(name.trim(), sheetResult?.sheet ?? null, extras)
    if (plan.kind === 'none') {
      setMessage('Nada mudou: não há o que salvar.')
      return
    }
    if (plan.kind === 'confirm-sheet') {
      setPendingSheet(plan.changes)
      return
    }
    await save(plan.run)
  }

  const confirmSheet = () => {
    const original = editedConfiguration
    if (!original || !pendingSheet) return
    const changes = pendingSheet
    void save(() => onUpdateConfiguration(original.id, changes))
  }

  const parent =
    request.entity === 'crane'
      ? `Fabricante: ${request.manufacturer.name}.`
      : request.entity === 'configuration'
        ? `Guindaste: ${request.crane.modelName}.`
        : 'O id é gerado pelo servidor.'
  const unshown = unshownFieldErrors(backendErrors, (field) =>
    request.entity === 'configuration'
      ? isConfigurationFormField(field) &&
        (withSheet || field === 'name' || isZoneOrHookField(field))
      : field === nameField,
  )
  const activeChartVersion =
    request.entity === 'configuration' ? request.activeChartVersion : undefined

  return (
    <>
      <Drawer
        open={pendingSheet === null}
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
              icon={editing ? <Save size={15} /> : <Plus size={15} />}
              loading={submitting}
            >
              {editing ? 'Salvar alterações' : 'Cadastrar'}
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
                {sheetLocked ? (
                  <p className={styles.drawerHint}>
                    A ficha técnica pode ser alterada, não removida. A ficha nova vale para as
                    próximas avaliações; as tabelas de carga não mudam.
                  </p>
                ) : (
                  <label className={styles.check}>
                    <input
                      type="checkbox"
                      checked={withSheet}
                      onChange={(event) => setWithSheet(event.currentTarget.checked)}
                    />
                    <span>Com ficha técnica (sem ela, a avaliação responde “não avaliável”)</span>
                  </label>
                )}
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
                <Field
                  label="Peso do gancho (kg)"
                  error={errors.hookBlockWeightKg}
                  hint="O peso do gancho que a tabela de carga já inclui. A avaliação compara carga + gancho com a capacidade (ADR-018). Vazio conta como 0."
                >
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min={0}
                    unit="kg"
                    value={hookText}
                    onChange={(event) => {
                      setHookText(event.currentTarget.value)
                      clearBackendError('hookBlockWeightKg')
                    }}
                  />
                </Field>
                <RotationZonesEditor rows={zoneRows} errors={errors} onChange={changeZoneRows} />
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

      <Dialog
        open={pendingSheet !== null}
        onClose={submitting ? () => undefined : () => setPendingSheet(null)}
        title={
          pendingSheet?.geometry !== undefined || pendingSheet === null
            ? `Mudar a ficha técnica de ${editedConfiguration?.name ?? 'configuração'}?`
            : `Mudar as zonas de giro ou o gancho de ${editedConfiguration?.name ?? 'configuração'}?`
        }
        description="As avaliações seguintes desta configuração mudam."
        footer={
          <>
            <Button variant="ghost" onClick={() => setPendingSheet(null)} disabled={submitting}>
              Voltar ao formulário
            </Button>
            <Button
              variant="primary"
              icon={<Save size={15} />}
              loading={submitting}
              onClick={confirmSheet}
            >
              {pendingSheet?.geometry !== undefined || pendingSheet === null
                ? 'Salvar a ficha nova'
                : 'Salvar as alterações'}
            </Button>
          </>
        }
      >
        <ul className={styles.confirmList}>
          {pendingSheet?.geometry !== undefined && (
            <li>
              Toda avaliação nova desta configuração passa a usar a ficha nova (a, h e os limites de
              L, θ, c e ψ): a posição da ponta da lança, o raio de trabalho e, com eles, a
              capacidade lida na tabela podem mudar.
            </li>
          )}
          {pendingSheet?.rotationZones !== undefined && (
            <li>
              {pendingSheet.rotationZones.length === 0
                ? 'A configuração deixa de ter zonas de giro: uma tabela passa a valer para todo o giro.'
                : `As zonas de giro passam a ser ${pendingSheet.rotationZones.map((zone) => zone.name).join(', ')}: o giro da torre escolhe a tabela de cada zona.`}
            </li>
          )}
          {pendingSheet?.hookBlockWeightKg !== undefined && (
            <li>
              O peso do gancho passa a{' '}
              <strong>
                {pendingSheet.hookBlockWeightKg === null
                  ? 'não informado (0 kg)'
                  : `${pendingSheet.hookBlockWeightKg.toLocaleString('pt-BR')} kg`}
              </strong>
              : o peso comparado com a capacidade (carga + gancho) e a utilização mudam.
            </li>
          )}
          <li>
            {typeof activeChartVersion === 'string' ? (
              <>
                A tabela ativa (<strong>{activeChartVersion}</strong>) continua a mesma
                {pendingSheet?.geometry !== undefined ? ': só a geometria muda.' : '.'}
              </>
            ) : (
              <>
                Não foi possível conferir a tabela ativa agora. Se houver uma, ela continua a mesma
                {pendingSheet?.geometry !== undefined ? ': só a geometria muda.' : '.'}
              </>
            )}
          </li>
          <li>Avaliações já exibidas não mudam.</li>
        </ul>
      </Dialog>
    </>
  )
}
