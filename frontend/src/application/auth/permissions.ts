// O que cada perfil pode fazer na tela (TASK-040; ADR-016 § 1, ADR-017 § 1). É só apresentação: quem
// decide é o backend, que responde 403 `FORBIDDEN` a qualquer ação fora do perfil.

import type { UserRole } from '../../domain/auth/user'

/**
 * Situação da sessão no frontend:
 * - `loading`: conferindo a sessão no backend;
 * - `disabled`: modo sem banco (ADR-016 § 5), sem login e com tudo aberto;
 * - `unauthenticated`: login ligado e ninguém logado;
 * - `authenticated`: há usuário logado.
 */
export type AuthStatus = 'loading' | 'disabled' | 'unauthenticated' | 'authenticated'

export interface Permissions {
  /**
   * Pode escrever no catálogo e nas tabelas (cadastrar, importar, ativar): ADMIN, ou o modo sem
   * autenticação (sem banco), em que as rotas ficam abertas.
   */
  readonly canEdit: boolean
  /** Pode abrir `/usuarios` e gerenciar contas: só ADMIN (sem banco não há usuários). */
  readonly canManageUsers: boolean
  /** Pode ver o catálogo, as tabelas e usar o simulador: qualquer sessão válida ou o modo sem banco. */
  readonly canView: boolean
  /** Explicação curta para um botão desabilitado quando `canEdit` é `false`. */
  readonly readOnlyReason: string | null
}

export const READ_ONLY_REASON = 'Só o perfil Administrador pode fazer esta alteração.'

export function permissionsFor(status: AuthStatus, role: UserRole | null): Permissions {
  const disabled = status === 'disabled'
  const admin = status === 'authenticated' && role === 'ADMIN'
  const canEdit = disabled || admin
  return {
    canEdit,
    canManageUsers: admin,
    canView: disabled || status === 'authenticated',
    readOnlyReason: canEdit ? null : READ_ONLY_REASON,
  }
}
