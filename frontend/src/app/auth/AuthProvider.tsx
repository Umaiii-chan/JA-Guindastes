import type { ReactNode } from 'react'

import { ANONYMOUS_AUTH, AuthContext } from './authContext'

/**
 * Provider FALSO de autenticação (TASK-039): sempre "sem autenticação". Ponto de encaixe da TASK-040,
 * que o substitui pelo provider real (login, sessão e perfis do backend da TASK-038).
 */
export function AuthProvider({ children }: { readonly children: ReactNode }) {
  return <AuthContext.Provider value={ANONYMOUS_AUTH}>{children}</AuthContext.Provider>
}
