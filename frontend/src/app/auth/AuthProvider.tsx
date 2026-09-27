import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'

import type { AuthGateway } from '../../application/auth/ports'
import { AuthRequestError, type User } from '../../domain/auth/user'
import { onApiAuthEvent } from '../../infrastructure/api/apiFetch'
import { createAuthRestClient } from '../../infrastructure/api/authRestClient'
import { isBackendAbsent } from './sessionCheckFailure'
import { AuthContext, type AuthState, type AuthUser, type SignInResult } from './authContext'

interface SessionState {
  readonly status: AuthState['status']
  readonly user: AuthUser | null
  readonly signedOutReason: AuthState['signedOutReason']
}

const LOADING: SessionState = { status: 'loading', user: null, signedOutReason: null }
const DISABLED: SessionState = { status: 'disabled', user: null, signedOutReason: null }

function toAuthUser(user: User): AuthUser {
  return { id: user.id, username: user.username, name: user.displayName, role: user.role }
}

function authenticated(user: User): SessionState {
  return { status: 'authenticated', user: toAuthUser(user), signedOutReason: null }
}

function unauthenticated(reason: SessionState['signedOutReason']): SessionState {
  return { status: 'unauthenticated', user: null, signedOutReason: reason }
}

export interface AuthProviderProps {
  /** Cliente de `/auth` injetável (testes). Padrão: o REST na mesma origem. */
  readonly gateway?: AuthGateway
  readonly children: ReactNode
}

/**
 * Sessão real (TASK-040; ADR-016): confere `GET /auth/session` na abertura, faz login e logout e
 * volta para `unauthenticated` quando qualquer chamada responde 401 `NOT_AUTHENTICATED`.
 *
 * Se a conferência da sessão falha porque o backend não está lá (sem backend, como no E2E contra o
 * `vite preview`), a aplicação cai no modo sem autenticação: é só apresentação, o backend continua
 * decidindo o acesso. Qualquer outra falha (ex.: HTTP 500) leva ao login, para a tela não oferecer
 * ações de admin a quem não se identificou (`isBackendAbsent`).
 */
export function AuthProvider({ gateway, children }: AuthProviderProps) {
  const [client] = useState(() => gateway ?? createAuthRestClient())
  const [session, setSession] = useState<SessionState>(LOADING)

  useEffect(() => {
    let cancelled = false
    client.getSession().then(
      (result) => {
        if (cancelled) return
        if (!result.authEnabled) setSession(DISABLED)
        else setSession(result.user ? authenticated(result.user) : unauthenticated(null))
      },
      (error: unknown) => {
        if (!cancelled) setSession(isBackendAbsent(error) ? DISABLED : unauthenticated(null))
      },
    )
    return () => {
      cancelled = true
    }
  }, [client])

  useEffect(
    () =>
      onApiAuthEvent((event) => {
        if (event.kind !== 'unauthenticated') return
        setSession((current) =>
          current.status === 'authenticated' || current.status === 'disabled'
            ? unauthenticated('expired')
            : current,
        )
      }),
    [],
  )

  const signIn = useCallback(
    async (username: string, password: string): Promise<SignInResult> => {
      try {
        const user = await client.login(username, password)
        setSession(authenticated(user))
        return { ok: true }
      } catch (error) {
        if (error instanceof AuthRequestError) {
          return { ok: false, code: error.code, message: error.message }
        }
        return { ok: false, code: 'UNKNOWN', message: String(error) }
      }
    },
    [client],
  )

  const signOut = useCallback(async () => {
    try {
      await client.logout()
    } catch {
      // Logout é idempotente: mesmo com falha de rede, a tela sai da sessão.
    }
    setSession(unauthenticated('signed-out'))
  }, [client])

  const value = useMemo<AuthState>(
    () => ({
      ...session,
      hasRole: (role) => session.user?.role === role,
      signIn,
      signOut,
    }),
    [session, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
