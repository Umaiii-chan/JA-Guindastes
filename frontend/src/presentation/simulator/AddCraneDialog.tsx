import { Link } from 'react-router'

import { selectedConfiguration } from '../../application/catalog/CatalogBrowser'
import { useCatalogBrowser } from '../../app/useCatalogBrowser'
import type { CraneConfiguration } from '../../domain/catalog/catalog'
import { ROUTES } from '../layout/navigation'
import { CatalogSelectionPanel } from '../panels/CatalogSelectionPanel'
import { Button, buttonClassName, Dialog } from '../ui'

export interface AddCraneDialogProps {
  /** Recebe a configuração escolhida; o guindaste entra no cenário ao lado do principal. */
  onConfirm(configuration: CraneConfiguration): void
  onClose(): void
}

/**
 * Janela "Adicionar guindaste" (TASK-074): escolhe fabricante, guindaste e configuração do catálogo
 * para um guindaste adicional do cenário. Tem a própria seleção, separada da do guindaste principal.
 * Monte só enquanto aberta: a lista de fabricantes é carregada ao montar.
 */
export function AddCraneDialog({ onConfirm, onClose }: AddCraneDialogProps) {
  const { catalog, state } = useCatalogBrowser()
  const chosen = selectedConfiguration(state)
  return (
    <Dialog
      open
      onClose={onClose}
      size="md"
      title="Adicionar guindaste"
      description="Escolha o fabricante, o guindaste e a configuração do segundo guindaste."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            disabled={chosen === null}
            onClick={() => chosen && onConfirm(chosen)}
          >
            Adicionar ao cenário
          </Button>
        </>
      }
    >
      <CatalogSelectionPanel
        embedded
        manufacturers={state.manufacturers}
        cranes={state.cranes}
        configurations={state.configurations}
        selectedManufacturerId={state.selectedManufacturerId}
        selectedCraneId={state.selectedCraneId}
        selectedConfigurationId={state.selectedConfigurationId}
        onSelectManufacturer={(id) => void catalog.selectManufacturer(id)}
        onSelectCrane={(id) => void catalog.selectCrane(id)}
        onSelectConfiguration={(id) => catalog.selectConfiguration(id)}
        onRetry={() => void catalog.loadManufacturers()}
        emptyAction={
          <Link to={ROUTES.catalog} className={buttonClassName('secondary', 'sm')}>
            Cadastrar no Catálogo
          </Link>
        }
      />
    </Dialog>
  )
}
