// Usuários, perfis e sessão vistos pelo frontend (TASK-040; ADR-016 §§ 1, 2 e 4). Os dados vêm do
// backend (TASK-038); aqui só os tipos e o erro das requisições, sem regra de negócio.

export type UserRole = 'ADMIN' | 'OPERATOR'

export const USER_ROLES: readonly UserRole[] = ['ADMIN', 'OPERATOR']

/** Rótulo do perfil na tela. */
export const ROLE_LABEL: Readonly<Record<UserRole, string>> = {
  ADMIN: 'Administrador',
  OPERATOR: 'Operador',
}

/** `User` do contrato do ADR-016 § 4 (sem senha nem hash). */
export interface User {
  readonly id: string
  readonly username: string
  readonly displayName: string
  readonly role: UserRole
  readonly active: boolean
  /** ISO-8601 com fuso. */
  readonly createdAt: string
}

/** `GET /auth/session`: `authEnabled: false` é o modo sem banco (ADR-016 § 5), sem login. */
export interface AuthSession {
  readonly authEnabled: boolean
  readonly user: User | null
}

/**
 * Códigos de erro. Os do backend chegam como vieram (`INVALID_CREDENTIALS`, `TOO_MANY_ATTEMPTS`,
 * `NOT_AUTHENTICATED`, `FORBIDDEN`, `USERNAME_TAKEN`, `LAST_ADMIN`, `OWN_ADMIN_ACCESS`,
 * `USER_NOT_FOUND`, `CSRF_HEADER_MISSING`); os do cliente são `VALIDATION` (422), `HTTP_ERROR`,
 * `NETWORK_ERROR` e `INVALID_RESPONSE`.
 */
export type AuthErrorCode = string

/** Erro de um campo apontado pelo backend (422), com o nome do campo do contrato (camelCase). */
export interface AuthFieldError {
  readonly field: string
  readonly message: string
}

/** Falha numa requisição de autenticação ou de usuários; `message` vai para a tela. */
export class AuthRequestError extends Error {
  readonly code: AuthErrorCode
  readonly httpStatus: number | null
  readonly fieldErrors: readonly AuthFieldError[]

  constructor(
    code: AuthErrorCode,
    message: string,
    httpStatus: number | null = null,
    fieldErrors: readonly AuthFieldError[] = [],
  ) {
    super(message)
    this.name = 'AuthRequestError'
    this.code = code
    this.httpStatus = httpStatus
    this.fieldErrors = fieldErrors
  }
}
