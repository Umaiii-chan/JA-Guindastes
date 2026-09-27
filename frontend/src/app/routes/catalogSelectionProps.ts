// Liga o painel de seleção do catálogo à `CatalogBrowser` compartilhada (Catálogo, Tabelas).

import type { CatalogContextValue } from '../catalog/catalogContext'
import type { CatalogSelectionPanelProps } from '../../presentation/panels/CatalogSelectionPanel'

export function catalogSelectionProps({
  catalog,
  state,
}: CatalogContextValue): CatalogSelectionPanelProps {
  return {
    manufacturers: state.manufacturers,
    cranes: state.cranes,
    configurations: state.configurations,
    selectedManufacturerId: state.selectedManufacturerId,
    selectedCraneId: state.selectedCraneId,
    selectedConfigurationId: state.selectedConfigurationId,
    onSelectManufacturer: (id) => void catalog.selectManufacturer(id),
    onSelectCrane: (id) => void catalog.selectCrane(id),
    onSelectConfiguration: (id) => catalog.selectConfiguration(id),
    onRetry: () => void catalog.loadManufacturers(),
  }
}
