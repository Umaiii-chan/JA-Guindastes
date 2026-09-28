// Zonas de giro da configuração (ADR-018; TASK-046) na tela: o atalho "Frontal 110° + lateral e
// traseira 250°", a leitura do formulário do editor e a validação local de cobertura.
//
// A validação que vale é a do backend (422 `INVALID_ROTATION_ZONES`). Aqui só se repete o que o
// contrato da TASK-046 § 3 diz, para o erro aparecer sem ida ao servidor:
// - pelo menos 2 zonas;
// - `code` único, 1 a 32 caracteres `[A-Z0-9_]`; `name` com 1 a 80 caracteres;
// - ângulos em [0°, 360°), na convenção de ψ do ADR-013; o setor vai de `start` a `end` no sentido
//   crescente e pode passar por 0°;
// - as zonas cobrem os 360° sem lacuna e sem sobreposição (fronteiras compartilhadas).
//
// `zoneAtRotation` só serve à PRÉ-VISUALIZAÇÃO (setor destacado na cena antes de o backend
// responder). A zona usada na avaliação, inclusive na fronteira (±ε, menor capacidade), é a do
// backend (RN-008).

import type { RotationZone } from '../../domain/catalog/catalog'

export const ZONE_CODE_PATTERN = /^[A-Z0-9_]{1,32}$/
export const ZONE_NAME_MAX_LENGTH = 80
export const MIN_ROTATION_ZONES = 2
export const HOOK_BLOCK_WEIGHT_MAX_KG = 100_000

/** Tolerância (°) na comparação das fronteiras digitadas. */
const ANGLE_TOLERANCE_DEG = 1e-6

/** Ângulo em [0°, 360°). */
export function normalizeDeg(value: number): number {
  const normalized = ((value % 360) + 360) % 360
  return Math.abs(normalized - 360) < ANGLE_TOLERANCE_DEG ? 0 : normalized
}

/** Abertura do setor (°), no sentido crescente de `start` a `end`; 0 quando `start = end`. */
export function zoneSpanDeg(zone: Pick<RotationZone, 'startDeg' | 'endDeg'>): number {
  return normalizeDeg(zone.endDeg - zone.startDeg)
}

/**
 * Atalho da tabela do MD 300L (ADR-018): frontal de 110° centrada na frente (305° → 55°) e lateral e
 * traseira com os 250° restantes (55° → 305°). Os nomes e códigos são sugestões editáveis.
 */
export const FRONT_110_REAR_250_PRESET: readonly RotationZone[] = [
  { code: 'FRONTAL', name: 'Frontal', startDeg: 305, endDeg: 55 },
  { code: 'LATERAL_TRASEIRA', name: 'Lateral e traseira', startDeg: 55, endDeg: 305 },
]

/**
 * Zona que contém ψ, só para a PRÉ-VISUALIZAÇÃO: o setor é [start, end) no sentido crescente. Sem
 * zonas, ou com zonas que não cobrem ψ, `null`.
 */
export function zoneAtRotation(
  zones: readonly RotationZone[],
  turretRotationDeg: number,
): RotationZone | null {
  if (!Number.isFinite(turretRotationDeg)) return null
  const psi = normalizeDeg(turretRotationDeg)
  return (
    zones.find((zone) => {
      const span = zoneSpanDeg(zone)
      return span > 0 && normalizeDeg(psi - zone.startDeg) < span
    }) ?? null
  )
}

/** Setor como texto: `305° → 55° (110°)`. */
export function formatZoneSector(zone: Pick<RotationZone, 'startDeg' | 'endDeg'>): string {
  const deg = (value: number) => `${value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}°`
  return `${deg(zone.startDeg)} → ${deg(zone.endDeg)} (${deg(zoneSpanDeg(zone))})`
}

/** As duas listas têm as mesmas zonas, na mesma ordem. */
export function sameRotationZones(a: readonly RotationZone[], b: readonly RotationZone[]): boolean {
  return (
    a.length === b.length &&
    a.every(
      (zone, index) =>
        zone.code === b[index].code &&
        zone.name === b[index].name &&
        zone.startDeg === b[index].startDeg &&
        zone.endDeg === b[index].endDeg,
    )
  )
}

/**
 * Problema de cobertura das zonas (lacuna, sobreposição, menos de 2 zonas), ou `null` se cobrem os
 * 360° sem sobreposição. Supõe ângulos já válidos em [0°, 360°).
 */
export function rotationZonesCoverageProblem(zones: readonly RotationZone[]): string | null {
  if (zones.length < MIN_ROTATION_ZONES) {
    return `Cadastre pelo menos ${MIN_ROTATION_ZONES} zonas, ou nenhuma (uma tabela para todo o giro).`
  }
  const empty = zones.find((zone) => zoneSpanDeg(zone) === 0)
  if (empty) {
    return `A zona ${empty.code || empty.name} começa e termina no mesmo ângulo: o setor fica vazio.`
  }
  const sorted = [...zones].sort((a, b) => a.startDeg - b.startDeg)
  for (let index = 0; index < sorted.length; index += 1) {
    const zone = sorted[index]
    const next = sorted[(index + 1) % sorted.length]
    const label = (item: RotationZone) => item.code || item.name || 'sem código'
    const toNextStart = normalizeDeg(next.startDeg - zone.startDeg)
    if (toNextStart === 0) {
      return `As zonas ${label(zone)} e ${label(next)} começam no mesmo ângulo (${zone.startDeg}°): elas se sobrepõem.`
    }
    const gap = normalizeDeg(next.startDeg - zone.endDeg)
    if (gap < ANGLE_TOLERANCE_DEG || 360 - gap < ANGLE_TOLERANCE_DEG) continue
    if (zoneSpanDeg(zone) > toNextStart) {
      return `As zonas ${label(zone)} e ${label(next)} se sobrepõem: ${label(zone)} termina em ${zone.endDeg}°, depois do início de ${label(next)} (${next.startDeg}°).`
    }
    return `Falta cobrir de ${zone.endDeg}° a ${next.startDeg}° (entre ${label(zone)} e ${label(next)}): as zonas precisam cobrir os 360°.`
  }
  return null
}

/** Uma linha do editor de zonas, como digitada. `key` só identifica a linha na tela. */
export interface ZoneFormRow {
  readonly key: string
  readonly code: string
  readonly name: string
  readonly startDeg: string
  readonly endDeg: string
}

export type ZoneRowField = 'code' | 'name' | 'startDeg' | 'endDeg'

/** Chave do erro de um campo da linha, no mesmo formato dos erros 422 (`rotationZones.<i>.<campo>`). */
export function zoneFieldPath(index: number, field: ZoneRowField): string {
  return `rotationZones.${index}.${field}`
}

/** Erro das zonas como um todo (cobertura, contagem), no formato dos erros 422. */
export const ZONES_FIELD = 'rotationZones'

export type ZoneRowsParseResult =
  | { readonly zones: readonly RotationZone[]; readonly errors: null }
  | { readonly zones: null; readonly errors: Readonly<Record<string, string>> }

let rowCounter = 0

export function zoneRowsFrom(zones: readonly RotationZone[]): ZoneFormRow[] {
  return zones.map((zone) => ({
    key: `zona-${(rowCounter += 1)}`,
    code: zone.code,
    name: zone.name,
    startDeg: String(zone.startDeg),
    endDeg: String(zone.endDeg),
  }))
}

export function emptyZoneRow(): ZoneFormRow {
  return { key: `zona-${(rowCounter += 1)}`, code: '', name: '', startDeg: '', endDeg: '' }
}

function parseAngle(text: string): { value: number } | { error: string } {
  const trimmed = text.trim()
  if (trimmed === '') return { error: 'Obrigatório.' }
  const value = Number(trimmed.replace(',', '.'))
  if (!Number.isFinite(value)) return { error: 'Informe um número.' }
  if (value < 0 || value >= 360) return { error: 'Use de 0° até menos de 360°.' }
  return { value }
}

/**
 * Lê o editor. Sem linhas = sem zonas (`[]`). Com linhas, confere cada campo e, se todos estão
 * certos, a cobertura dos 360° (erro em `rotationZones`).
 */
export function parseZoneRows(rows: readonly ZoneFormRow[]): ZoneRowsParseResult {
  if (rows.length === 0) return { zones: [], errors: null }
  const errors: Record<string, string> = {}
  const zones: RotationZone[] = []
  const codes = new Map<string, number>()

  rows.forEach((row, index) => {
    const code = row.code.trim()
    const name = row.name.trim()
    if (code === '') errors[zoneFieldPath(index, 'code')] = 'Obrigatório.'
    else if (!ZONE_CODE_PATTERN.test(code)) {
      errors[zoneFieldPath(index, 'code')] =
        'Use de 1 a 32 caracteres: letras maiúsculas, números e _.'
    } else if (codes.has(code)) {
      errors[zoneFieldPath(index, 'code')] = `Código repetido (zona ${(codes.get(code) ?? 0) + 1}).`
    } else codes.set(code, index)

    if (name === '') errors[zoneFieldPath(index, 'name')] = 'Obrigatório.'
    else if (name.length > ZONE_NAME_MAX_LENGTH) {
      errors[zoneFieldPath(index, 'name')] = `Até ${ZONE_NAME_MAX_LENGTH} caracteres.`
    }

    const start = parseAngle(row.startDeg)
    const end = parseAngle(row.endDeg)
    if ('error' in start) errors[zoneFieldPath(index, 'startDeg')] = start.error
    if ('error' in end) errors[zoneFieldPath(index, 'endDeg')] = end.error
    if ('value' in start && 'value' in end) {
      zones.push({ code, name, startDeg: start.value, endDeg: end.value })
    }
  })

  if (Object.keys(errors).length > 0) return { zones: null, errors }
  const coverage = rotationZonesCoverageProblem(zones)
  if (coverage !== null) return { zones: null, errors: { [ZONES_FIELD]: coverage } }
  return { zones, errors: null }
}

export type HookWeightParseResult =
  | { readonly value: number | null; readonly error: null }
  | { readonly value: null; readonly error: string }

/** Peso do gancho (kg), como no contrato: vazio = não informado; senão, de 0 a 100.000. */
export function parseHookBlockWeight(text: string): HookWeightParseResult {
  const trimmed = text.trim()
  if (trimmed === '') return { value: null, error: null }
  const value = Number(trimmed.replace(',', '.'))
  if (!Number.isFinite(value)) return { value: null, error: 'Informe um número.' }
  if (value < 0) return { value: null, error: 'Não pode ser negativo.' }
  if (value > HOOK_BLOCK_WEIGHT_MAX_KG) {
    return {
      value: null,
      error: `No máximo ${HOOK_BLOCK_WEIGHT_MAX_KG.toLocaleString('pt-BR')} kg.`,
    }
  }
  return { value, error: null }
}
