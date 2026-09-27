// Raiz da aplicação (TASK-039; ADR-017): roteador do navegador, estado compartilhado e rotas.

import { BrowserRouter } from 'react-router'

import { AppProviders } from './AppProviders'
import { AppRoutes } from './AppRoutes'

export default function App() {
  return (
    <BrowserRouter>
      <AppProviders>
        <AppRoutes />
      </AppProviders>
    </BrowserRouter>
  )
}
