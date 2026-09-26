// Números técnicos das telas de catálogo e tabelas (RN-006: metros, graus e kg), em pt-BR.

export function formatNumber(value: number, fractionDigits = 2): string {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: fractionDigits })
}

export function formatMeters(value: number): string {
  return `${formatNumber(value)} m`
}

export function formatDegrees(value: number): string {
  return `${formatNumber(value, 1)}°`
}

export function formatKg(value: number): string {
  return `${formatNumber(value, 0)} kg`
}

/** Data e hora locais curtas (ex.: "26/09/2026 14:05"). */
export function formatDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}
