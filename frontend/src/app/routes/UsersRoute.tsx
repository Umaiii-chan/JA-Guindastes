import { useState } from 'react'

import { createUsersRestClient } from '../../infrastructure/api/usersRestClient'
import { UsersPage } from '../../presentation/pages/UsersPage'
import { useAuth } from '../auth/authContext'

/** `/usuarios` (TASK-040): a guarda de perfil (ADMIN) fica em `AppRoutes`. */
export function UsersRoute() {
  const auth = useAuth()
  const [gateway] = useState(createUsersRestClient)
  return (
    <UsersPage
      mode={auth.status === 'disabled' ? 'disabled' : 'enabled'}
      gateway={gateway}
      currentUserId={auth.user?.id ?? null}
    />
  )
}
