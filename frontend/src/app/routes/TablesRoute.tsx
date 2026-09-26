import { useState } from 'react'

import { selectedConfiguration } from '../../application/catalog/CatalogBrowser'
import { createLoadChartRestClient } from '../../infrastructure/api/loadChartRestClient'
import { TablesPage } from '../../presentation/pages/TablesPage'
import { useCatalog } from '../catalog/catalogContext'
import { catalogSelectionProps } from './catalogSelectionProps'

export function TablesRoute() {
  const context = useCatalog()
  const [gateway] = useState(createLoadChartRestClient)
  return (
    <TablesPage
      selection={catalogSelectionProps(context)}
      gateway={gateway}
      configurationId={selectedConfiguration(context.state)?.id}
    />
  )
}
