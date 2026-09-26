import type { CatalogMutationResult } from '../../application/catalog/CatalogBrowser'
import { selectedConfiguration } from '../../application/catalog/CatalogBrowser'
import { CatalogPage } from '../../presentation/pages/CatalogPage'
import { useToast } from '../../presentation/ui'
import { useCatalog } from '../catalog/catalogContext'
import { catalogSelectionProps } from './catalogSelectionProps'

export function CatalogRoute() {
  const context = useCatalog()
  const { catalog, state } = context
  const toast = useToast()

  /** Avisa o cadastro gravado também numa notificação (o formulário mostra a mensagem ao lado). */
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
      selection={catalogSelectionProps(context)}
      selectedConfiguration={selectedConfiguration(state)}
      registration={{
        selectedManufacturer:
          state.manufacturers.items.find((item) => item.id === state.selectedManufacturerId) ??
          null,
        selectedCrane: state.cranes.items.find((item) => item.id === state.selectedCraneId) ?? null,
        onCreateManufacturer: (name) =>
          notify(catalog.createManufacturer(name), `Fabricante "${name}" cadastrado`),
        onCreateCrane: (manufacturerId, modelName) =>
          notify(
            catalog.createCrane(manufacturerId, modelName),
            `Guindaste "${modelName}" cadastrado`,
          ),
        onCreateConfiguration: (craneId, name, geometry) =>
          notify(
            catalog.createConfiguration(craneId, name, geometry),
            `Configuração "${name}" cadastrada`,
          ),
      }}
    />
  )
}
