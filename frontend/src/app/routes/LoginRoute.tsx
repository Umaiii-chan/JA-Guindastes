import { useEffect, useRef } from 'react'
import { Navigate, useLocation } from 'react-router'

import { ROUTES } from '../../presentation/layout/navigation'
import { LoginPage } from '../../presentation/pages/LoginPage'
import { useToast } from '../../presentation/ui'
import { useAuth } from '../auth/authContext'
import type { LoginRedirectState } from '../auth/RouteGuards'

/** Destino depois do login: o que a guarda guardou, se for um caminho interno; senão, o Início. */
function destinationFrom(state: unknown): string {
  const from = (state as LoginRedirectState | null)?.from
  if (!from || typeof from.pathname !== 'string' || !from.pathname.startsWith('/')) {
    return ROUTES.home
  }
  if (from.pathname.startsWith('//') || from.pathname === ROUTES.login) return ROUTES.home
  return `${from.pathname}${from.search ?? ''}${from.hash ?? ''}`
}

/**
 * `/login` (TASK-040): logado → vai ao destino; modo sem banco → vai ao Início com o aviso; senão, o
 * formulário. O redirecionamento depois do login é declarativo (a sessão nova remonta as rotas).
 */
export function LoginRoute() {
  const auth = useAuth()
  const location = useLocation()
  const toast = useToast()
  const warned = useRef(false)

  useEffect(() => {
    if (auth.status !== 'disabled' || warned.current) return
    warned.current = true
    toast.show({
      tone: 'warning',
      title: 'Modo sem autenticação (sem banco)',
      description:
        'O backend está sem banco de dados: não há login e todas as ações ficam abertas.',
    })
  }, [auth.status, toast])

  if (auth.status === 'authenticated') {
    return <Navigate to={destinationFrom(location.state)} replace />
  }
  if (auth.status === 'disabled') return <Navigate to={ROUTES.home} replace />

  const notice =
    auth.signedOutReason === 'expired'
      ? { tone: 'warning' as const, text: 'A sessão acabou. Entre de novo para continuar.' }
      : auth.signedOutReason === 'signed-out'
        ? { tone: 'info' as const, text: 'Você saiu da sessão.' }
        : null

  return (
    <LoginPage
      status={auth.status === 'loading' ? 'checking' : 'ready'}
      notice={notice}
      onSubmit={auth.signIn}
    />
  )
}
