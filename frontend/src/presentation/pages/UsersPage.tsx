import { KeyRound, Users } from 'lucide-react'

import { Page } from '../layout/Page'
import { Badge, EmptyState, Panel } from '../ui'

/**
 * Usuários (ADR-017 § 1): espaço reservado. A lista de contas, os perfis (ADMIN, Operador) e a guarda
 * da rota chegam com o login (TASK-040, sobre o backend da TASK-038).
 */
export function UsersPage() {
  return (
    <Page width="narrow">
      <Panel
        title="Usuários"
        icon={<Users size={16} />}
        actions={<Badge tone="neutral">em breve</Badge>}
      >
        <EmptyState
          icon={<KeyRound size={24} />}
          title="A gestão de usuários chega com o login"
          description="Aqui o administrador vai listar as contas, criar usuários e definir o perfil de cada um (ADMIN edita; Operador só consulta). Por enquanto, a aplicação funciona sem autenticação."
        />
      </Panel>
    </Page>
  )
}
