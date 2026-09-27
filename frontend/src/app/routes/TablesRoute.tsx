import { useState } from 'react'

import { selectedConfiguration } from '../../application/catalog/CatalogBrowser'
import { createLoadChartRestClient } from '../../infrastructure/api/loadChartRestClient'
import { TablesPage } from '../../presentation/pages/TablesPage'
import { useCatalog } from '../catalog/catalogContext'
import { usePermissions } from '../auth/usePermissions'
import { catalogSelectionProps } from './catalogSelectionProps'

export function TablesRoute() {
  const context = useCatalog()
  const { canEdit } = usePermissions()
  const [gateway] = useState(createLoadChartRestClient)
  return (
    <TablesPage
      selection={catalogSelectionProps(context)}
      configuration={selectedConfiguration(context.state)}
      gateway={gateway}
      canEdit={canEdit}
    />
  )
}
