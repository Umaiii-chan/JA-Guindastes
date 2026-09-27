// Rotas do ADR-017 § 1 (TASK-039). Separadas do `App` para os testes montarem com `MemoryRouter`.
//
// - TASK-040: `/login` com o formulário real; as rotas dentro da casca passam por `RequireAuth`, que
//   redireciona para `/login` preservando o destino; `/usuarios` exige perfil ADMIN (`RequireRole`);
//   o trilho esconde a seção de administração de quem não é ADMIN.
// - TASK-042: `/catalogo` e `/tabelas` trocam as páginas simples pelas completas (e leem
//   `usePermissions()` para esconder as ações de escrita do Operador).

import { Route, Routes } from 'react-router'

import { ROLE_LABEL } from '../domain/auth/user'
import { AppShell } from '../presentation/layout/AppShell'
import { HelpButton } from '../presentation/layout/HelpButton'
import { type NavItem, ROUTES } from '../presentation/layout/navigation'
import { UserMenu } from '../presentation/layout/UserMenu'
import { NotFoundPage } from '../presentation/pages/NotFoundPage'
import { useAuth } from './auth/authContext'
import { RequireAuth, RequireRole } from './auth/RouteGuards'
import { usePermissions } from './auth/usePermissions'
import { CatalogRoute } from './routes/CatalogRoute'
import { HomeRoute } from './routes/HomeRoute'
import { LoginRoute } from './routes/LoginRoute'
import { SimulatorRoute } from './routes/SimulatorRoute'
import { TablesRoute } from './routes/TablesRoute'
import { UsersRoute } from './routes/UsersRoute'

export function AppRoutes() {
  const auth = useAuth()
  const { canManageUsers } = usePermissions()
  const user = auth.user
    ? { name: auth.user.name, role: ROLE_LABEL[auth.user.role], username: auth.user.username }
    : null
  // No modo sem banco, a seção de administração continua visível (a página explica o modo).
  const isNavItemVisible = (item: NavItem) =>
    item.section !== 'admin' || canManageUsers || auth.status === 'disabled'

  return (
    <Routes>
      <Route path={ROUTES.login} element={<LoginRoute />} />
      <Route
        element={
          <RequireAuth>
            <AppShell
              userMenu={<UserMenu user={user} onSignOut={auth.signOut} />}
              topBarActions={<HelpButton />}
              isNavItemVisible={isNavItemVisible}
            />
          </RequireAuth>
        }
      >
        <Route index element={<HomeRoute />} />
        <Route path={ROUTES.simulator} element={<SimulatorRoute />} />
        <Route path={ROUTES.catalog} element={<CatalogRoute />} />
        <Route path={ROUTES.tables} element={<TablesRoute />} />
        <Route
          path={ROUTES.users}
          element={
            <RequireRole role="ADMIN">
              <UsersRoute />
            </RequireRole>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
