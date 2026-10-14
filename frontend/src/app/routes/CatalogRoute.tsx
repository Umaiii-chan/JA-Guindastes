import { useState } from 'react'

import type { CatalogMutationResult } from '../../application/catalog/CatalogBrowser'
import { createCatalogRestClient } from '../../infrastructure/api/catalogRestClient'
import { createLoadChartRestClient } from '../../infrastructure/api/loadChartRestClient'
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

  /** Avisa o cadastro gravado numa notificação; o erro fica no próprio formulário do Drawer. */
  const notify = async <T,>(
    promise: Promise<CatalogMutationResult<T>>,
    title: string,
    description = 'Já está escolhido na seleção.',
  ): Promise<CatalogMutationResult<T>> => {
    const result = await promise
    if (result.ok) toast.show({ tone: 'ok', title, description })
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
      canEdit={canEdit}
      onCreateManufacturer={(name) =>
        notify(catalog.createManufacturer(name), `Fabricante "${name}" cadastrado`)
      }
      onCreateCrane={(manufacturerId, modelName, limits) =>
        notify(
          catalog.createCrane(manufacturerId, modelName, limits),
          `Guindaste "${modelName}" cadastrado`,
        )
      }
      onCreateConfiguration={(craneId, name, geometry, extras) =>
        notify(
          catalog.createConfiguration(craneId, name, geometry, extras),
          `Configuração "${name}" cadastrada`,
        )
      }
      onUpdateManufacturer={(id, name) =>
        notify(
          catalog.updateManufacturer(id, name),
          `Fabricante renomeado para "${name}"`,
          'O nome novo já vale em todas as telas.',
        )
      }
      onUpdateCrane={(id, modelName, limits) =>
        notify(
          catalog.updateCrane(id, modelName, limits),
          limits === undefined ? `Guindaste renomeado para "${modelName}"` : 'Guindaste alterado',
          limits === undefined
            ? 'O nome novo já vale em todas as telas.'
            : 'Os limites novos valem para as próximas avaliações.',
        )
      }
      onUpdateConfiguration={(id, changes) =>
        notify(
          catalog.updateConfiguration(id, changes),
          'Configuração alterada',
          changes.geometry
            ? 'A ficha nova vale para as próximas avaliações; as tabelas de carga não mudaram.'
            : changes.rotationZones !== undefined || changes.hookBlockWeightKg !== undefined
              ? 'As zonas de giro e o peso do gancho novos valem para as próximas avaliações.'
              : 'O nome novo já vale em todas as telas.',
        )
      }
    />
  )
}
