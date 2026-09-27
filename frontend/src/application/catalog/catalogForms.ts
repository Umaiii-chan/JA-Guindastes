// Formulários de cadastro do catálogo (TASK-033): leitura dos campos de texto e validação local
// básica, antes de enviar. A validação que vale é a do backend (TASK-030: schemas estritos e a
// `CraneGeometry` do domínio); aqui só se repete o que está documentado lá, para o usuário ver o erro
// sem ida ao servidor: nome obrigatório, número finito, comprimentos e altura ≥ 0, mínimo ≤ máximo e
// os dois limites de giro juntos (ADR-013 C-4). O resto (ex.: faixa de θ) chega como erro 422.

import type {
  CatalogRequestError,
  CraneConfiguration,
  CraneTechnicalSheet,
} from '../../domain/catalog/catalog'
import type { ConfigurationChanges } from './ports'

export type SheetFieldKey = keyof CraneTechnicalSheet

/** Campos da ficha na ordem do ADR-013 C-4. */
export const SHEET_FIELD_KEYS: readonly SheetFieldKey[] = [
  'boomPivotOffsetM',
  'boomPivotHeightM',
  'boomLengthMinM',
  'boomLengthMaxM',
  'boomAngleMinDeg',
  'boomAngleMaxDeg',
  'cableLengthMinM',
  'cableLengthMaxM',
  'turretRotationMinDeg',
  'turretRotationMaxDeg',
]

const OPTIONAL_FIELDS: ReadonlySet<SheetFieldKey> = new Set([
  'cableLengthMaxM',
  'turretRotationMinDeg',
  'turretRotationMaxDeg',
])

/** `ge=0` no schema do backend. `a` (boomPivotOffsetM) tem sinal e os ângulos também. */
const NON_NEGATIVE_FIELDS: ReadonlySet<SheetFieldKey> = new Set([
  'boomPivotHeightM',
  'boomLengthMinM',
  'boomLengthMaxM',
  'cableLengthMinM',
  'cableLengthMaxM',
])

const RANGE_PAIRS: readonly (readonly [SheetFieldKey, SheetFieldKey])[] = [
  ['boomLengthMinM', 'boomLengthMaxM'],
  ['boomAngleMinDeg', 'boomAngleMaxDeg'],
  ['cableLengthMinM', 'cableLengthMaxM'],
  ['turretRotationMinDeg', 'turretRotationMaxDeg'],
]

/** Texto de cada campo da ficha, como digitado. */
export type SheetFormValues = Readonly<Record<SheetFieldKey, string>>

export const EMPTY_SHEET_FORM: SheetFormValues = {
  boomPivotOffsetM: '',
  boomPivotHeightM: '',
  boomLengthMinM: '',
  boomLengthMaxM: '',
  boomAngleMinDeg: '',
  boomAngleMaxDeg: '',
  cableLengthMinM: '',
  cableLengthMaxM: '',
  turretRotationMinDeg: '',
  turretRotationMaxDeg: '',
}

/**
 * Erros por campo, com as chaves de `CatalogFieldError.field` (`name`, `modelName`, `geometry`,
 * `geometry.<campo>`). A chave vazia guarda o que não é de nenhum campo.
 */
export type FormErrors = Readonly<Record<string, string>>

export function sheetFieldPath(key: SheetFieldKey): string {
  return `geometry.${key}`
}

/** Nome obrigatório (o backend recusa vazio ou só espaços). Devolve a mensagem ou `null`. */
export function validateRequiredName(text: string): string | null {
  return text.trim() === '' ? 'Obrigatório.' : null
}

export type SheetParseResult =
  | { readonly sheet: CraneTechnicalSheet; readonly errors: null }
  | { readonly sheet: null; readonly errors: FormErrors }

export function parseTechnicalSheet(values: SheetFormValues): SheetParseResult {
  const errors: Record<string, string> = {}
  const numbers: Partial<Record<SheetFieldKey, number | null>> = {}

  for (const key of SHEET_FIELD_KEYS) {
    const text = values[key].trim()
    if (text === '') {
      if (OPTIONAL_FIELDS.has(key)) numbers[key] = null
      else errors[sheetFieldPath(key)] = 'Obrigatório.'
      continue
    }
    const value = Number(text)
    if (!Number.isFinite(value)) {
      errors[sheetFieldPath(key)] = 'Informe um número.'
    } else if (NON_NEGATIVE_FIELDS.has(key) && value < 0) {
      errors[sheetFieldPath(key)] = 'Não pode ser negativo.'
    } else {
      numbers[key] = value
    }
  }

  const turretMin = numbers.turretRotationMinDeg
  const turretMax = numbers.turretRotationMaxDeg
  if (
    turretMin !== undefined &&
    turretMax !== undefined &&
    (turretMin === null) !== (turretMax === null)
  ) {
    const missing = turretMin === null ? 'turretRotationMinDeg' : 'turretRotationMaxDeg'
    errors[sheetFieldPath(missing)] = 'Informe os dois limites de giro, ou nenhum (giro contínuo).'
  }

  for (const [minKey, maxKey] of RANGE_PAIRS) {
    const min = numbers[minKey]
    const max = numbers[maxKey]
    if (typeof min === 'number' && typeof max === 'number' && min > max) {
      errors[sheetFieldPath(maxKey)] = 'O máximo não pode ser menor que o mínimo.'
    }
  }

  if (Object.keys(errors).length > 0) return { sheet: null, errors }
  return { sheet: numbers as CraneTechnicalSheet, errors: null }
}

/**
 * Traduz o erro do backend para o formulário: erros 422 vão para os campos (o primeiro de cada campo)
 * e `message` resume. Erro sem campo (ex.: 404 do guindaste, 409, rede) fica só em `message`.
 */
export function formErrorsFromRequest(error: CatalogRequestError): {
  readonly fieldErrors: FormErrors
  readonly message: string
} {
  const fieldErrors: Record<string, string> = {}
  for (const { field, message } of error.fieldErrors) {
    if (!(field in fieldErrors)) fieldErrors[field] = message
  }
  return { fieldErrors, message: error.message }
}

/** As duas fichas têm os mesmos valores (`null` = sem ficha). */
export function sameTechnicalSheet(
  a: CraneTechnicalSheet | null,
  b: CraneTechnicalSheet | null,
): boolean {
  if (a === null || b === null) return a === b
  return SHEET_FIELD_KEYS.every((key) => a[key] === b[key])
}

/**
 * O que mudou na configuração editada (TASK-044): o nome, se diferente, e a ficha, se preenchida e
 * diferente da atual. Vazio quando nada mudou. A ficha nunca é removida (o backend não aceita
 * `geometry: null` na alteração).
 */
export function configurationChanges(
  original: CraneConfiguration,
  name: string,
  sheet: CraneTechnicalSheet | null,
): ConfigurationChanges {
  const trimmed = name.trim()
  return {
    ...(trimmed !== original.name && { name: trimmed }),
    ...(sheet !== null && !sameTechnicalSheet(sheet, original.geometry) && { geometry: sheet }),
  }
}

/**
 * Erros cujos campos o formulário não mostra (ex.: `manufacturerId` no formulário do guindaste), como
 * `campo: mensagem`, para não se perderem.
 */
export function unshownFieldErrors(
  fieldErrors: FormErrors,
  isShown: (field: string) => boolean,
): readonly string[] {
  return Object.entries(fieldErrors)
    .filter(([field]) => !isShown(field))
    .map(([field, message]) => (field === '' ? message : `${field}: ${message}`))
}

/** Campos que o formulário da configuração mostra: o nome, a ficha inteira e cada campo da ficha. */
export function isConfigurationFormField(field: string): boolean {
  return (
    field === 'name' ||
    field === 'geometry' ||
    SHEET_FIELD_KEYS.some((key) => field === sheetFieldPath(key))
  )
}
