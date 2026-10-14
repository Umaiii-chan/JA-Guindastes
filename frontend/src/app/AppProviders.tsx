import type { ReactNode } from 'react'

import type { AiGateway } from '../application/ai/ports'
import type { AuthGateway } from '../application/auth/ports'
import { ToastProvider } from '../presentation/ui'
import { AiProvider } from './ai/AiProvider'
import { useAuth } from './auth/authContext'
import { AuthProvider } from './auth/AuthProvider'
import { CatalogProvider } from './catalog/CatalogProvider'
import { ScenarioProvider } from './scenario/ScenarioProvider'
import { SimulatorDraftProvider } from './simulator/SimulatorDraftProvider'

/**
 * Estado compartilhado entre as páginas: sessão, notificações e, só com sessão válida (ou no modo
 * sem banco), catálogo, rascunho do simulador e cenário (TASK-052).
 */
export function AppProviders({
  children,
  authGateway,
  aiGateway,
}: {
  readonly children: ReactNode
  /** Cliente de `/auth` injetável (testes). */
  readonly authGateway?: AuthGateway
  /** Cliente de `/ai` injetável (testes). */
  readonly aiGateway?: AiGateway
}) {
  return (
    <AuthProvider gateway={authGateway}>
      <ToastProvider>
        <SessionScope aiGateway={aiGateway}>{children}</SessionScope>
      </ToastProvider>
    </AuthProvider>
  )
}

/**
 * O catálogo e o rascunho pertencem à sessão (TASK-040): só montam depois que a sessão é conhecida
 * (nada de chamadas que respondem 401 antes do login) e recomeçam quando o usuário muda.
 */
function SessionScope({
  children,
  aiGateway,
}: {
  readonly children: ReactNode
  readonly aiGateway?: AiGateway
}) {
  const { status, user } = useAuth()
  if (status !== 'authenticated' && status !== 'disabled') return <>{children}</>
  return (
    <CatalogProvider key={user?.id ?? 'sem-autenticacao'}>
      <SimulatorDraftProvider>
        <ScenarioProvider>
          <AiProvider gateway={aiGateway}>{children}</AiProvider>
        </ScenarioProvider>
      </SimulatorDraftProvider>
    </CatalogProvider>
  )
}
