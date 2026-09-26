// Estado de autenticação da aplicação (ponto de encaixe da TASK-040; ADR-016/017).
//
// Hoje não há login: o `AuthProvider` falso devolve sempre `anonymous`, e todas as rotas ficam
// abertas. A TASK-040 troca a implementação do provider (sessão do backend da TASK-038) sem mudar
// quem consome `useAuth()`: a casca lê `user` para o menu do usuário, e as guardas de rota leem
// `status` e `hasRole`.

import { createContext, useContext } from 'react'

export type UserRole = 'ADMIN' | 'OPERATOR'

export interface AuthUser {
  readonly id: string
  readonly name: string
  readonly role: UserRole
}

export interface AuthState {
  /**
   * `anonymous`: sem autenticação (hoje, sempre). A TASK-040 acrescenta `loading` e `authenticated`.
   */
  readonly status: 'anonymous' | 'loading' | 'authenticated'
  readonly user: AuthUser | null
  /** O usuário tem o perfil? Sem autenticação, `false`. */
  hasRole(role: UserRole): boolean
  /** Encerra a sessão. Sem autenticação, não faz nada. */
  signOut(): Promise<void>
}

export const ANONYMOUS_AUTH: AuthState = {
  status: 'anonymous',
  user: null,
  hasRole: () => false,
  signOut: async () => undefined,
}

export const AuthContext = createContext<AuthState>(ANONYMOUS_AUTH)

export function useAuth(): AuthState {
  return useContext(AuthContext)
}
