import { useId } from 'react'

import type { CatalogList } from '../../application/catalog/CatalogBrowser'
import type { Crane, CraneConfiguration, Manufacturer } from '../../domain/catalog/catalog'

export interface CatalogSelectionPanelProps {
  readonly manufacturers: CatalogList<Manufacturer>
  readonly cranes: CatalogList<Crane>
  readonly configurations: CatalogList<CraneConfiguration>
  readonly selectedManufacturerId: string | null
  readonly selectedCraneId: string | null
  readonly selectedConfigurationId: string | null
  onSelectManufacturer(id: string | null): void
  onSelectCrane(id: string | null): void
  onSelectConfiguration(id: string | null): void
}

interface SelectOption {
  readonly id: string
  readonly label: string
}

/**
 * Seleção encadeada do catálogo (RF-010): fabricante → guindaste → configuração. A configuração
 * escolhida é a que vai para a avaliação no backend e define os limites dos sliders (TASK-033).
 */
export function CatalogSelectionPanel(props: CatalogSelectionPanelProps) {
  const titleId = `${useId()}-title`
  const {
    manufacturers,
    cranes,
    configurations,
    selectedManufacturerId,
    selectedCraneId,
    selectedConfigurationId,
  } = props

  return (
    <section className="catalog-panel" aria-labelledby={titleId}>
      <h2 id={titleId}>Guindaste e configuração</h2>
      <CatalogSelect
        label="Fabricante"
        list={manufacturers}
        options={manufacturers.items.map((item) => ({ id: item.id, label: item.name }))}
        selectedId={selectedManufacturerId}
        enabled
        emptyText="Nenhum fabricante cadastrado."
        onSelect={props.onSelectManufacturer}
      />
      <CatalogSelect
        label="Guindaste"
        list={cranes}
        options={cranes.items.map((item) => ({ id: item.id, label: item.modelName }))}
        selectedId={selectedCraneId}
        enabled={selectedManufacturerId !== null}
        emptyText="Nenhum guindaste cadastrado neste fabricante."
        onSelect={props.onSelectCrane}
      />
      <CatalogSelect
        label="Configuração"
        list={configurations}
        options={configurations.items.map((item) => ({
          id: item.id,
          label: item.geometry ? item.name : `${item.name} (sem ficha técnica)`,
        }))}
        selectedId={selectedConfigurationId}
        enabled={selectedCraneId !== null}
        emptyText="Nenhuma configuração cadastrada neste guindaste."
        onSelect={props.onSelectConfiguration}
      />
    </section>
  )
}

function CatalogSelect({
  label,
  list,
  options,
  selectedId,
  enabled,
  emptyText,
  onSelect,
}: {
  readonly label: string
  readonly list: CatalogList<unknown>
  readonly options: readonly SelectOption[]
  readonly selectedId: string | null
  readonly enabled: boolean
  readonly emptyText: string
  onSelect(id: string | null): void
}) {
  const selectId = useId()
  const statusId = `${selectId}-status`
  let status: string | null = null
  if (list.status === 'loading') status = 'Carregando…'
  else if (list.status === 'error') status = list.error
  else if (list.status === 'loaded' && options.length === 0) status = emptyText

  return (
    <div className="catalog-panel__field">
      <label htmlFor={selectId}>{label}</label>
      <select
        id={selectId}
        value={selectedId ?? ''}
        disabled={!enabled || list.status === 'loading'}
        aria-describedby={status ? statusId : undefined}
        onChange={(event) => onSelect(event.currentTarget.value || null)}
      >
        <option value="">— escolha —</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      {status && (
        <span
          id={statusId}
          className={
            list.status === 'error' ? 'catalog-panel__status--error' : 'catalog-panel__status'
          }
          role={list.status === 'error' ? 'alert' : undefined}
        >
          {status}
        </span>
      )}
    </div>
  )
}
