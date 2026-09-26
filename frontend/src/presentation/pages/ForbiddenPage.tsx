import { House, ShieldAlert } from 'lucide-react'
import { Link } from 'react-router'

import { ROUTES } from '../layout/navigation'
import { Page } from '../layout/Page'
import { buttonClassName, EmptyState } from '../ui'

export interface ForbiddenPageProps {
  /** Perfil exigido, para a explicação (ex.: Administrador). */
  readonly requiredRole: string
}

/** Rota fora do perfil do usuário logado (ADR-017 § 1): "sem permissão", com volta ao início. */
export function ForbiddenPage({ requiredRole }: ForbiddenPageProps) {
  return (
    <Page width="narrow">
      <EmptyState
        icon={<ShieldAlert size={26} />}
        tone="warning"
        role="alert"
        title="Sem permissão"
        description={`Esta página é só para o perfil ${requiredRole}. Se precisar de acesso, fale com um administrador.`}
        action={
          <Link to={ROUTES.home} className={buttonClassName('primary', 'md')}>
            <House size={16} aria-hidden="true" />
            Ir para o início
          </Link>
        }
      />
    </Page>
  )
}
