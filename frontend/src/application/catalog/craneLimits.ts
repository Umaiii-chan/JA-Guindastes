// Limites do modelo de guindaste no formulário do catálogo (TASK-051; RN-011, RN-013; ADR-022).
//
// O backend valida e guarda (CHECKs no banco e `CraneLimits` no domínio); aqui só se repetem as
// faixas documentadas, para o erro aparecer no campo antes de gravar. Os padrões de inclinação são
// FICTÍCIOS até haver dado oficial (ADR-012).

import type { Crane, CraneLimits } from '../../domain/catalog/catalog'
import type { FormErrors } from './catalogForms'

export const CRANE_LIMIT_KEYS = [
  'capacityLimitPercent',
  'warningBandPercent',
  'maxGroundSlopeDeg',
  'maxLevelingDeg',
  'slopeDeratingPercentPerDeg',
  'craneMassKg',
  'outriggerPadAreaM2',
] as const

export type CraneLimitKey = (typeof CRANE_LIMIT_KEYS)[number]

export const DEFAULT_CRANE_LIMITS: CraneLimits = {
  capacityLimitPercent: 100,
  warningBandPercent: 90,
  maxGroundSlopeDeg: 1,
  maxLevelingDeg: 3,
  slopeDeratingPercentPerDeg: 10,
  craneMassKg: 36000,
  outriggerPadAreaM2: 0.5,
}

/** Faixa aceita de cada campo (igual à do backend). */
export const CRANE_LIMIT_RANGES: Readonly<Record<CraneLimitKey, { min: number; max: number }>> = {
  capacityLimitPercent: { min: 1, max: 100 },
  warningBandPercent: { min: 1, max: 100 },
  maxGroundSlopeDeg: { min: 0, max: 45 },
  maxLevelingDeg: { min: 0, max: 45 },
  slopeDeratingPercentPerDeg: { min: 0, max: 100 },
  craneMassKg: { min: 1, max: 1_000_000 },
  outriggerPadAreaM2: { min: 0.01, max: 100 },
}

export type CraneLimitsFormValues = Readonly<Record<CraneLimitKey, string>>

/** Os limites do guindaste (ou os padrões, se o backend não os informou) como texto do formulário. */
export function craneLimitsToForm(crane?: Crane): CraneLimitsFormValues {
  const values = {} as Record<CraneLimitKey, string>
  for (const key of CRANE_LIMIT_KEYS)
    values[key] = String(crane?.[key] ?? DEFAULT_CRANE_LIMITS[key])
  return values
}

export type CraneLimitsParseResult =
  | { readonly limits: CraneLimits; readonly errors: null }
  | { readonly limits: null; readonly errors: FormErrors }

export function parseCraneLimits(values: CraneLimitsFormValues): CraneLimitsParseResult {
  const errors: Record<string, string> = {}
  const numbers = {} as Record<CraneLimitKey, number>
  for (const key of CRANE_LIMIT_KEYS) {
    const text = values[key].trim()
    const { min, max } = CRANE_LIMIT_RANGES[key]
    const value = Number(text)
    if (text === '') errors[key] = 'Obrigatório.'
    else if (!Number.isFinite(value)) errors[key] = 'Informe um número.'
    else if (value < min || value > max) errors[key] = `Deve estar entre ${min} e ${max}.`
    else numbers[key] = value
  }
  if (Object.keys(errors).length > 0) return { limits: null, errors }
  return { limits: numbers, errors: null }
}

/** Só os limites que diferem dos do guindaste (ou dos padrões); `null` se nada mudou. */
export function craneLimitChanges(
  original: Crane | undefined,
  limits: CraneLimits,
): Partial<CraneLimits> | null {
  const changes: Partial<Record<CraneLimitKey, number>> = {}
  for (const key of CRANE_LIMIT_KEYS) {
    if (limits[key] !== (original?.[key] ?? DEFAULT_CRANE_LIMITS[key])) changes[key] = limits[key]
  }
  return Object.keys(changes).length > 0 ? changes : null
}

/** Campo do formulário do guindaste que é um dos limites. */
export function isCraneLimitField(field: string): boolean {
  return (CRANE_LIMIT_KEYS as readonly string[]).includes(field)
}
