// Formulário de usuário (TASK-040): conferência antes de enviar, com as regras de forma do ADR-016
// § 2. O backend confere de novo e responde 422; aqui só evita a ida e volta e diz o que corrigir.

import type { UserRole } from '../../domain/auth/user'
import type { NewUser, UserChanges } from './ports'

export const USERNAME_PATTERN = /^[a-z0-9._-]{3,64}$/
export const PASSWORD_MIN_LENGTH = 10
export const PASSWORD_MAX_LENGTH = 128

export interface UserFormValues {
  readonly username: string
  readonly displayName: string
  readonly role: UserRole
  /** Na edição, vazio = não troca a senha. */
  readonly password: string
}

export type UserFormField = 'username' | 'displayName' | 'role' | 'password'

export type UserFormErrors = Partial<Record<UserFormField, string>>

function passwordError(password: string, required: boolean): string | undefined {
  if (password === '') return required ? 'Informe a senha.' : undefined
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `A senha precisa de pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return `A senha pode ter no máximo ${PASSWORD_MAX_LENGTH} caracteres.`
  }
  return undefined
}

function displayNameError(displayName: string): string | undefined {
  return displayName.trim() === '' ? 'Informe o nome de exibição.' : undefined
}

export type CreateUserFormResult =
  | { readonly ok: true; readonly value: NewUser }
  | { readonly ok: false; readonly errors: UserFormErrors }

/** Criação: nome de usuário em minúsculas (como o backend guarda), nome e senha obrigatórios. */
export function validateNewUser(values: UserFormValues): CreateUserFormResult {
  const username = values.username.trim().toLowerCase()
  const errors: UserFormErrors = {}
  if (!USERNAME_PATTERN.test(username)) {
    errors.username = 'Use de 3 a 64 caracteres: letras minúsculas, números, ponto, hífen ou "_".'
  }
  const nameError = displayNameError(values.displayName)
  if (nameError) errors.displayName = nameError
  const pwError = passwordError(values.password, true)
  if (pwError) errors.password = pwError
  if (Object.keys(errors).length > 0) return { ok: false, errors }
  return {
    ok: true,
    value: {
      username,
      displayName: values.displayName.trim(),
      password: values.password,
      role: values.role,
    },
  }
}

export type UpdateUserFormResult =
  | { readonly ok: true; readonly value: UserChanges }
  | { readonly ok: false; readonly errors: UserFormErrors }

/** Edição: manda só o que mudou; senha vazia = mantém a atual. */
export function validateUserChanges(
  values: UserFormValues,
  current: { readonly displayName: string; readonly role: UserRole },
): UpdateUserFormResult {
  const errors: UserFormErrors = {}
  const nameError = displayNameError(values.displayName)
  if (nameError) errors.displayName = nameError
  const pwError = passwordError(values.password, false)
  if (pwError) errors.password = pwError
  if (Object.keys(errors).length > 0) return { ok: false, errors }

  const displayName = values.displayName.trim()
  return {
    ok: true,
    value: {
      ...(displayName !== current.displayName ? { displayName } : {}),
      ...(values.role !== current.role ? { role: values.role } : {}),
      ...(values.password !== '' ? { password: values.password } : {}),
    },
  }
}
