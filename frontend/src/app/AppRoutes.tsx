// Rotas do ADR-017 § 1 (TASK-039). Separadas do `App` para os testes montarem com `MemoryRouter`.
//
// Pontos de encaixe:
// - TASK-040: `/login` ganha o formulário real, as rotas dentro da casca passam por uma guarda que
//   redireciona para `/login` preservando o destino, e `/usuarios` exige perfil ADMIN;
// - TASK-042: `/catalogo` e `/tabelas` trocam as páginas simples pelas completas.

import { Route, Routes } from 'react-router'

import { AppShell } from '../presentation/layout/AppShell'
import { HelpButton } from '../presentation/layout/HelpButton'
import { ROUTES } from '../presentation/layout/navigation'
import { UserMenu } from '../presentation/layout/UserMenu'
import { LoginPage } from '../presentation/pages/LoginPage'
import { NotFoundPage } from '../presentation/pages/NotFoundPage'
import { UsersPage } from '../presentation/pages/UsersPage'
import { useAuth } from './auth/authContext'
import { CatalogRoute } from './routes/CatalogRoute'
import { HomeRoute } from './routes/HomeRoute'
import { SimulatorRoute } from './routes/SimulatorRoute'
import { TablesRoute } from './routes/TablesRoute'

const ROLE_LABEL = { ADMIN: 'Administrador', OPERATOR: 'Operador' } as const

export function AppRoutes() {
  const auth = useAuth()
  const user = auth.user ? { name: auth.user.name, role: ROLE_LABEL[auth.user.role] } : null

  return (
    <Routes>
      <Route path={ROUTES.login} element={<LoginPage />} />
      <Route
        element={<AppShell userMenu={<UserMenu user={user} />} topBarActions={<HelpButton />} />}
      >
        <Route index element={<HomeRoute />} />
        <Route path={ROUTES.simulator} element={<SimulatorRoute />} />
        <Route path={ROUTES.catalog} element={<CatalogRoute />} />
        <Route path={ROUTES.tables} element={<TablesRoute />} />
        <Route path={ROUTES.users} element={<UsersPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
