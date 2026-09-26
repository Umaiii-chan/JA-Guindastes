import type { ReactNode } from 'react'

import { ToastProvider } from '../presentation/ui'
import { AuthProvider } from './auth/AuthProvider'
import { CatalogProvider } from './catalog/CatalogProvider'
import { SimulatorDraftProvider } from './simulator/SimulatorDraftProvider'

/** Estado compartilhado entre as páginas: autenticação (falsa), catálogo, rascunho e notificações. */
export function AppProviders({ children }: { readonly children: ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>
        <CatalogProvider>
          <SimulatorDraftProvider>{children}</SimulatorDraftProvider>
        </CatalogProvider>
      </ToastProvider>
    </AuthProvider>
  )
}
