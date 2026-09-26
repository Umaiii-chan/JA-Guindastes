// Guardas de rota (TASK-040; ADR-017 § 1):
// - `RequireAuth`: conferindo a sessão → tela de espera; sem sessão → `/login`, levando o destino em
//   `state.from` (menos quando a pessoa saiu por "Sair"); com sessão ou no modo sem banco → a rota.
// - `RequireRole`: usuário logado sem o perfil → "Sem permissão" (no modo sem banco, a rota abre).
// - dentro da guarda, um 403 `FORBIDDEN` de qualquer chamada vira a notificação "Sem permissão".

import { type ReactNode, useEffect } from 'react'
import { Navigate, useLocation } from 'react-router'

import { ROLE_LABEL, type UserRole } from '../../domain/auth/user'
import { onApiAuthEvent } from '../../infrastructure/api/apiFetch'
import { ROUTES } from '../../presentation/layout/navigation'
import { SessionCheckScreen } from '../../presentation/layout/SessionCheckScreen'
import { ForbiddenPage } from '../../presentation/pages/ForbiddenPage'
import { useToast } from '../../presentation/ui'
import { useAuth } from './authContext'

/** Destino guardado para depois do login. */
export interface LoginRedirectState {
  readonly from?: { readonly pathname: string; readonly search?: string; readonly hash?: string }
}

export function RequireAuth({ children }: { readonly children: ReactNode }) {
  const auth = useAuth()
  const location = useLocation()

  if (auth.status === 'loading') return <SessionCheckScreen />
  if (auth.status === 'unauthenticated') {
    const state: LoginRedirectState | undefined =
      auth.signedOutReason === 'signed-out'
        ? undefined
        : {
            from: { pathname: location.pathname, search: location.search, hash: location.hash },
          }
    return <Navigate to={ROUTES.login} replace state={state} />
  }
  return (
    <>
      <ForbiddenNotifier />
      {children}
    </>
  )
}

export function RequireRole({
  role,
  children,
}: {
  readonly role: UserRole
  readonly children: ReactNode
}) {
  const auth = useAuth()
  if (auth.status === 'authenticated' && !auth.hasRole(role)) {
    return <ForbiddenPage requiredRole={ROLE_LABEL[role]} />
  }
  return <>{children}</>
}

function ForbiddenNotifier() {
  const toast = useToast()
  useEffect(
    () =>
      onApiAuthEvent((event) => {
        if (event.kind !== 'forbidden') return
        toast.show({
          tone: 'danger',
          title: 'Sem permissão',
          description: event.message ?? 'O seu perfil não permite esta ação.',
        })
      }),
    [toast],
  )
  return null
}
