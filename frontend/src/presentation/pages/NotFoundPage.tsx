import { House, SearchX } from 'lucide-react'
import { Link, useLocation } from 'react-router'

import { ROUTES } from '../layout/navigation'
import { Page } from '../layout/Page'
import { buttonClassName, EmptyState } from '../ui'

/** Rota inexistente (`*`, ADR-017 § 1). */
export function NotFoundPage() {
  const location = useLocation()
  return (
    <Page width="narrow">
      <EmptyState
        icon={<SearchX size={26} />}
        tone="neutral"
        title="Página não encontrada"
        description={
          <>
            Não existe nada em <code>{location.pathname}</code>. Confira o endereço ou volte ao
            início.
          </>
        }
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
