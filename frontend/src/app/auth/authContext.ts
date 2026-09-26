// Estado de autenticação da aplicação (TASK-040; ADR-016/017). O `AuthProvider` confere a sessão no
// backend (`GET /auth/session`) e guarda quem está logado; a casca lê `user` para o menu do usuário,
// as guardas de rota leem `status` e `hasRole`, e as páginas leem as permissões por `usePermissions()`.

import { createContext, useContext } from 'react'

import type { AuthStatus } from '../../application/auth/permissions'
import type { UserRole } from '../../domain/auth/user'

export type { AuthStatus } from '../../application/auth/permissions'
export type { UserRole } from '../../domain/auth/user'

export interface AuthUser {
  readonly id: string
  readonly username: string
  /** Nome de exibição (`displayName`). */
  readonly name: string
  readonly role: UserRole
}

export type SignInResult =
  { readonly ok: true } | { readonly ok: false; readonly code: string; readonly message: string }

export interface AuthState {
  readonly status: AuthStatus
  readonly user: AuthUser | null
  /**
   * Por que não há sessão: a pessoa saiu (`signed-out`) ou a sessão acabou no meio do uso (`expired`,
   * um 401 `NOT_AUTHENTICATED` em alguma chamada). `null` nos demais casos.
   */
  readonly signedOutReason: 'signed-out' | 'expired' | null
  /** O usuário logado tem o perfil? Sem usuário (inclusive no modo sem banco), `false`. */
  hasRole(role: UserRole): boolean
  /** `POST /auth/login`. Não lança: devolve o código e a mensagem do erro (401, 429, rede). */
  signIn(username: string, password: string): Promise<SignInResult>
  /** `POST /auth/logout` e volta para `unauthenticated`. */
  signOut(): Promise<void>
}

/** Sem `AuthProvider` acima (testes de página): age como o modo sem banco, com tudo aberto. */
export const NO_AUTH_STATE: AuthState = {
  status: 'disabled',
  user: null,
  signedOutReason: null,
  hasRole: () => false,
  signIn: async () => ({
    ok: false,
    code: 'AUTH_DISABLED',
    message: 'Modo sem autenticação (sem banco).',
  }),
  signOut: async () => undefined,
}

export const AuthContext = createContext<AuthState>(NO_AUTH_STATE)

export function useAuth(): AuthState {
  return useContext(AuthContext)
}
