// Permissões da sessão atual para as páginas (TASK-040). Ponto de encaixe da TASK-042 (catálogo e
// tabelas): o componente de rota lê `useCan()` e passa `canEdit` e `readOnlyReason` para a página, que
// esconde ou desabilita (com a explicação) as ações de escrita do Operador.

import { useMemo } from 'react'

import { type Permissions, permissionsFor } from '../../application/auth/permissions'
import { useAuth } from './authContext'

export type { Permissions } from '../../application/auth/permissions'

/** `{canEdit, canManageUsers, canView, readOnlyReason}` da sessão atual. */
export function usePermissions(): Permissions {
  const { status, user } = useAuth()
  const role = user?.role ?? null
  return useMemo(() => permissionsFor(status, role), [status, role])
}

/** Apelido de `usePermissions()`. */
export const useCan = usePermissions
