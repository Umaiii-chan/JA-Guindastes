import { useState } from 'react'

import type { CatalogMutationResult } from '../../application/catalog/CatalogBrowser'
import { createCatalogRestClient } from '../../infrastructure/api/catalogRestClient'
import { createLoadChartRestClient } from '../../infrastructure/api/loadChartRestClient'
import { createKnownChartsStorage } from '../../infrastructure/storage/knownChartsStorage'
import { CatalogPage } from '../../presentation/pages/CatalogPage'
import { useToast } from '../../presentation/ui'
import { useCatalog } from '../catalog/catalogContext'
import { usePermissions } from '../auth/usePermissions'

export function CatalogRoute() {
  const { catalog, state } = useCatalog()
  const { canEdit } = usePermissions()
  const toast = useToast()
  const [catalogGateway] = useState(() => createCatalogRestClient())
  const [loadChartGateway] = useState(() => createLoadChartRestClient())
  const [store] = useState(() => createKnownChartsStorage())

  /** Avisa o cadastro gravado numa notificação; o erro fica no próprio formulário do Drawer. */
  const notify = async <T,>(
    promise: Promise<CatalogMutationResult<T>>,
    title: string,
  ): Promise<CatalogMutationResult<T>> => {
    const result = await promise
    if (result.ok) toast.show({ tone: 'ok', title, description: 'Já está escolhido na seleção.' })
    return result
  }

  return (
    <CatalogPage
      selection={{
        selectedManufacturerId: state.selectedManufacturerId,
        selectedCraneId: state.selectedCraneId,
        selectedConfigurationId: state.selectedConfigurationId,
        onSelectManufacturer: (id) => void catalog.selectManufacturer(id),
        onSelectCrane: (id) => void catalog.selectCrane(id),
        onSelectConfiguration: (id) => catalog.selectConfiguration(id),
      }}
      catalogGateway={catalogGateway}
      loadChartGateway={loadChartGateway}
      store={store}
      canEdit={canEdit}
      onCreateManufacturer={(name) =>
        notify(catalog.createManufacturer(name), `Fabricante "${name}" cadastrado`)
      }
      onCreateCrane={(manufacturerId, modelName) =>
        notify(
          catalog.createCrane(manufacturerId, modelName),
          `Guindaste "${modelName}" cadastrado`,
        )
      }
      onCreateConfiguration={(craneId, name, geometry) =>
        notify(
          catalog.createConfiguration(craneId, name, geometry),
          `Configuração "${name}" cadastrada`,
        )
      }
    />
  )
}
