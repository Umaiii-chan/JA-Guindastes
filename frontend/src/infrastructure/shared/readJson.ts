// Leitura defensiva de JSON vindo do backend (TASK-032). O contrato é conferido campo a campo para
// que uma resposta fora do formato vire um erro exibido, e não um `undefined` silencioso na tela.

/** A resposta do backend não segue o contrato esperado. `path` diz onde. */
export class ContractViolationError extends Error {
  readonly path: string

  constructor(path: string, expected: string) {
    super(`Resposta fora do contrato em "${path}": esperado ${expected}.`)
    this.name = 'ContractViolationError'
    this.path = path
  }
}

export type JsonRecord = Readonly<Record<string, unknown>>

export function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function readRecord(value: unknown, path: string): JsonRecord {
  if (!isRecord(value)) throw new ContractViolationError(path, 'objeto')
  return value
}

export function readNumber(record: JsonRecord, key: string, path: string): number {
  const value = record[key]
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ContractViolationError(`${path}.${key}`, 'número finito')
  }
  return value
}

export function readNullableNumber(record: JsonRecord, key: string, path: string): number | null {
  return record[key] === null || record[key] === undefined ? null : readNumber(record, key, path)
}

export function readString(record: JsonRecord, key: string, path: string): string {
  const value = record[key]
  if (typeof value !== 'string') throw new ContractViolationError(`${path}.${key}`, 'texto')
  return value
}

export function readNullableString(record: JsonRecord, key: string, path: string): string | null {
  return record[key] === null || record[key] === undefined ? null : readString(record, key, path)
}

export function readArray(record: JsonRecord, key: string, path: string): readonly unknown[] {
  const value = record[key]
  if (!Array.isArray(value)) throw new ContractViolationError(`${path}.${key}`, 'lista')
  return value
}

/** Lê `record[key]` como objeto ou `null`; ausente conta como `null`. */
export function readNullableRecord(
  record: JsonRecord,
  key: string,
  path: string,
): JsonRecord | null {
  const value = record[key]
  return value === null || value === undefined ? null : readRecord(value, `${path}.${key}`)
}
