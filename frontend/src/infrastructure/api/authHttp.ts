// Transporte comum dos clientes de `/auth` e `/users` (TASK-040): envia pelo `createApiFetch` (cookie
// e CSRF), lê o corpo de erro `{detail, code}` do backend (TASK-038) e o 422 do FastAPI, e confere o
// contrato da resposta. Toda falha vira `AuthRequestError`.

import { AuthRequestError, type AuthFieldError, type User } from '../../domain/auth/user'
import {
  ContractViolationError,
  isRecord,
  readRecord,
  readString,
  type JsonRecord,
} from '../shared/readJson'
import { createApiFetch } from './apiFetch'

export interface AuthHttpOptions {
  /** `fetch` injetável (testes). Padrão: o `fetch` global, embrulhado por `createApiFetch`. */
  readonly fetchFn?: typeof fetch
  /** Prefixo da origem; vazio = mesma origem (proxy do Vite em dev, nginx no container). */
  readonly baseUrl?: string
}

export type SendJson = (
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
) => Promise<{ readonly status: number; readonly json: unknown }>

/** Mensagens padrão por código do backend, quando o `detail` não vem. */
const DEFAULT_MESSAGES: Readonly<Record<string, string>> = {
  INVALID_CREDENTIALS: 'Usuário ou senha incorretos.',
  TOO_MANY_ATTEMPTS: 'Muitas tentativas de login. Aguarde alguns minutos e tente de novo.',
  NOT_AUTHENTICATED: 'A sessão acabou. Entre de novo.',
  FORBIDDEN: 'Sem permissão para esta ação.',
  USERNAME_TAKEN: 'Esse nome de usuário já existe.',
  LAST_ADMIN: 'O sistema precisa de pelo menos um administrador ativo.',
  OWN_ADMIN_ACCESS: 'Você não pode desativar a própria conta nem tirar o próprio perfil de admin.',
  USER_NOT_FOUND: 'Usuário não encontrado.',
  CSRF_HEADER_MISSING: 'Requisição recusada pelo servidor (cabeçalho de proteção ausente).',
  SCENARIO_NOT_FOUND: 'Cenário não encontrado (talvez já tenha sido apagado).',
}

export function createSendJson(options: AuthHttpOptions = {}): SendJson {
  const fetchFn = createApiFetch(options.fetchFn)
  const baseUrl = options.baseUrl ?? ''

  return async (method, path, body) => {
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    let response: Response
    try {
      response = await fetchFn(`${baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      })
    } catch {
      throw new AuthRequestError(
        'NETWORK_ERROR',
        'Não foi possível falar com o servidor (falha de rede).',
      )
    }
    const json = await readBody(response)
    if (!response.ok) throw errorFromResponse(response.status, json)
    return { status: response.status, json }
  }
}

async function readBody(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined
  try {
    return (await response.json()) as unknown
  } catch {
    return undefined
  }
}

export function errorFromResponse(status: number, body: unknown): AuthRequestError {
  const detail = isRecord(body) ? body.detail : undefined
  if (status === 422 && Array.isArray(detail)) {
    return new AuthRequestError(
      'VALIDATION',
      'O servidor recusou os dados (HTTP 422). Corrija os campos indicados.',
      status,
      detail.map(toFieldError),
    )
  }
  const code = isRecord(body) && typeof body.code === 'string' ? body.code : null
  const message = typeof detail === 'string' && detail.trim() !== '' ? detail : null
  if (code !== null) {
    return new AuthRequestError(
      code,
      message ?? DEFAULT_MESSAGES[code] ?? `Erro ${code} (HTTP ${status}).`,
      status,
    )
  }
  return new AuthRequestError(
    'HTTP_ERROR',
    `O servidor respondeu HTTP ${status}${message ? `: ${message}` : ''}.`,
    status,
  )
}

/** Um item do `detail` do 422 (`{loc, msg}`); `loc` começa com `"body"` e já vem em camelCase. */
function toFieldError(item: unknown): AuthFieldError {
  if (!isRecord(item)) return { field: '', message: 'Dado inválido.' }
  const message = typeof item.msg === 'string' ? item.msg : 'Dado inválido.'
  const loc = Array.isArray(item.loc) ? item.loc.map(String) : []
  const path = loc[0] === 'body' ? loc.slice(1) : loc
  return { field: path.join('.'), message }
}

/** Converte a resposta com o contrato conferido; fora do contrato → `INVALID_RESPONSE`. */
export function guardContract<T>(map: () => T): T {
  try {
    return map()
  } catch (error) {
    if (error instanceof ContractViolationError) {
      throw new AuthRequestError('INVALID_RESPONSE', error.message)
    }
    throw error
  }
}

export function readBoolean(record: JsonRecord, key: string, path: string): boolean {
  const value = record[key]
  if (typeof value !== 'boolean') throw new ContractViolationError(`${path}.${key}`, 'booleano')
  return value
}

export function mapUser(json: unknown, path: string): User {
  const record = readRecord(json, path)
  const role = readString(record, 'role', path)
  if (role !== 'ADMIN' && role !== 'OPERATOR') {
    throw new ContractViolationError(`${path}.role`, '"ADMIN" ou "OPERATOR"')
  }
  return {
    id: readString(record, 'id', path),
    username: readString(record, 'username', path),
    displayName: readString(record, 'displayName', path),
    role,
    active: readBoolean(record, 'active', path),
    createdAt: readString(record, 'createdAt', path),
  }
}
