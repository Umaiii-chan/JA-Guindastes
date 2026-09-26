import { useState } from 'react'

import { selectedConfiguration } from '../../application/catalog/CatalogBrowser'
import { createLoadChartRestClient } from '../../infrastructure/api/loadChartRestClient'
import { createKnownChartsStorage } from '../../infrastructure/storage/knownChartsStorage'
import { TablesPage } from '../../presentation/pages/TablesPage'
import { useCatalog } from '../catalog/catalogContext'
import { useCanEdit } from '../permissions/useCanEdit'
import { catalogSelectionProps } from './catalogSelectionProps'

export function TablesRoute() {
  const context = useCatalog()
  const canEdit = useCanEdit()
  const [gateway] = useState(createLoadChartRestClient)
  const [store] = useState(() => createKnownChartsStorage())
  return (
    <TablesPage
      selection={catalogSelectionProps(context)}
      configuration={selectedConfiguration(context.state)}
      gateway={gateway}
      store={store}
      canEdit={canEdit}
    />
  )
}
