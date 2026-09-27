import { HomePage } from '../../presentation/pages/HomePage'
import { useCatalogSummary } from '../useCatalogSummary'

export function HomeRoute() {
  const { state, reload } = useCatalogSummary()
  return <HomePage catalog={state} onRetryCatalog={reload} />
}
