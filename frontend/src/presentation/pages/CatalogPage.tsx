import {
  Building2,
  Construction,
  Lock,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  TriangleAlert,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'

import {
  type CatalogTree,
  configurationCountOf,
  configurationsOf,
  countCatalogTree,
  cranesOf,
  filterCatalogTree,
} from '../../application/catalog/catalogTree'
import type { CatalogGateway } from '../../application/catalog/ports'
import { firstActiveVersion } from '../../application/loadChart/chartVersions'
import { createLoadChartCache } from '../../application/loadChart/loadChartCache'
import type { LoadChartGateway } from '../../application/loadChart/ports'
import { CatalogColumn, ColumnEmpty } from '../catalog/CatalogColumn'
import {
  type CatalogDrawerRequest,
  CatalogEntityDrawer,
  type CatalogMutations,
} from '../catalog/CatalogEntityDrawer'
import styles from '../catalog/catalog.module.css'
import { ConfigurationDetail } from '../catalog/ConfigurationDetail'
import { useCatalogTree } from '../catalog/useCatalogTree'
import { Page } from '../layout/Page'
import { useChartVersions } from '../tables/useChartVersions'
import { useStoredChart } from '../tables/useStoredChart'
import { Badge, Button, EmptyState, IconButton, Input, Panel } from '../ui'

export interface CatalogSelection {
  readonly selectedManufacturerId: string | null
  readonly selectedCraneId: string | null
  readonly selectedConfigurationId: string | null
  onSelectManufacturer(id: string): void
  onSelectCrane(id: string): void
  onSelectConfiguration(id: string): void
}

export interface CatalogPageProps extends CatalogMutations {
  /** Seleção compartilhada com o Simulador e as Tabelas (`CatalogBrowser`). */
  readonly selection: CatalogSelection
  /** Leitura do catálogo inteiro (contagens e busca). */
  readonly catalogGateway: Pick<
    CatalogGateway,
    'listManufacturers' | 'listCranes' | 'listConfigurations'
  >
  /** Tabelas da configuração e pontos da ativa (TASK-044). */
  readonly loadChartGateway: Pick<LoadChartGateway, 'listConfigurationCharts' | 'getChart'>
  /** Cadastrar e editar (ADR-017 § 1: ADMIN edita; Operador só vê). Ligado ao perfil pela TASK-040. */
  readonly canEdit: boolean
}

const EMPTY_TREE: CatalogTree = {
  manufacturers: [],
  cranesByManufacturer: new Map(),
  configurationsByCrane: new Map(),
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`
}

/**
 * Catálogo (ADR-017 § 1; CA-1 da TASK-042): navegação mestre-detalhe fabricante → guindaste →
 * configuração, com busca e contagens, detalhe da configuração (ficha técnica e tabela ativa) e
 * cadastros em Drawer. A escolha continua valendo no Simulador e nas Tabelas.
 */
export function CatalogPage({
  selection,
  catalogGateway,
  loadChartGateway,
  canEdit,
  ...mutations
}: CatalogPageProps) {
  const { state, reload } = useCatalogTree(catalogGateway)
  const [query, setQuery] = useState('')
  const [drawer, setDrawer] = useState<CatalogDrawerRequest | null>(null)
  const versions = useChartVersions(loadChartGateway, selection.selectedConfigurationId)
  const [chartCache] = useState(() => createLoadChartCache(loadChartGateway))

  const tree = state.tree
  const fullTree = tree ?? EMPTY_TREE
  const filtered = useMemo(() => (tree ? filterCatalogTree(tree, query) : null), [tree, query])
  const totals = tree ? countCatalogTree(tree) : null
  const loading = state.status === 'loading' && tree === null
  const searching = query.trim() !== ''

  const manufacturer =
    tree?.manufacturers.find((item) => item.id === selection.selectedManufacturerId) ?? null
  const crane = tree
    ? (cranesOf(tree, selection.selectedManufacturerId).find(
        (item) => item.id === selection.selectedCraneId,
      ) ?? null)
    : null
  const configuration = tree
    ? (configurationsOf(tree, selection.selectedCraneId).find(
        (item) => item.id === selection.selectedConfigurationId,
      ) ?? null)
    : null

  // Com zonas (TASK-046), a matriz do detalhe é a da primeira zona com tabela ativa.
  const active = firstActiveVersion(
    versions.state.versions,
    versions.state.activeCharts,
    (configuration?.rotationZones ?? []).map((zone) => zone.code),
    versions.state.activeChartId,
  )
  const activeChart = useStoredChart(chartCache, active?.chartId ?? null)

  const noResults = (what: string) => (
    <ColumnEmpty
      icon={<Search size={20} />}
      title={`Nenhum ${what} encontrado`}
      description={`Nada corresponde a “${query.trim()}”.`}
    />
  )

  const newButton = (label: string, request: CatalogDrawerRequest | null) =>
    canEdit && request ? (
      <IconButton
        label={label}
        icon={<Plus size={16} />}
        size="sm"
        onClick={() => setDrawer(request)}
      />
    ) : undefined

  return (
    <Page
      width="wide"
      intro="Navegue do fabricante à configuração, confira a ficha técnica e a tabela ativa. A configuração escolhida aqui continua escolhida no Simulador e nas Tabelas."
      actions={
        canEdit ? (
          <Button
            variant="primary"
            icon={<Plus size={16} />}
            onClick={() => setDrawer({ entity: 'manufacturer' })}
          >
            Novo fabricante
          </Button>
        ) : (
          <Badge tone="neutral" icon={<Lock size={12} />}>
            Somente leitura
          </Badge>
        )
      }
    >
      <div className={styles.toolbar}>
        <div className={styles.search} role="search">
          <label htmlFor="catalog-search" className="visually-hidden">
            Buscar no catálogo
          </label>
          <Input
            id="catalog-search"
            type="search"
            placeholder="Buscar fabricante, modelo ou configuração…"
            leadingIcon={<Search size={15} />}
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setQuery('')
            }}
          />
          {searching && (
            <IconButton
              label="Limpar a busca"
              icon={<X size={14} />}
              size="sm"
              tooltip="none"
              className={styles.searchClear}
              onClick={() => setQuery('')}
            />
          )}
        </div>
        {totals && (
          <ul className={styles.totals} aria-label="Totais do catálogo">
            <li>
              <strong>{totals.manufacturers}</strong> fabricantes
            </li>
            <li>
              <strong>{totals.cranes}</strong> guindastes
            </li>
            <li>
              <strong>{totals.configurations}</strong> configurações
            </li>
          </ul>
        )}
        {state.status === 'loading' && tree !== null && (
          <span className={styles.refreshing} role="status">
            Atualizando…
          </span>
        )}
      </div>

      {state.status === 'error' ? (
        <Panel>
          <EmptyState
            tone="danger"
            role="alert"
            icon={<TriangleAlert size={24} />}
            title="Não foi possível ler o catálogo"
            description={state.error}
            action={
              <Button icon={<RefreshCw size={15} />} onClick={reload}>
                Tentar de novo
              </Button>
            }
          />
        </Panel>
      ) : (
        <>
          <div className={styles.columns}>
            <CatalogColumn
              title="Fabricantes"
              stamp="01"
              loading={loading}
              highlight={query}
              hasChildren
              selectedId={selection.selectedManufacturerId}
              onSelect={selection.onSelectManufacturer}
              items={(filtered?.manufacturers ?? []).map((item) => {
                const craneCount = cranesOf(fullTree, item.id).length
                return {
                  id: item.id,
                  label: item.name,
                  meta: `${plural(craneCount, 'guindaste', 'guindastes')} · ${plural(configurationCountOf(fullTree, item.id), 'configuração', 'configurações')}`,
                }
              })}
              actions={newButton('Novo fabricante', { entity: 'manufacturer' })}
              empty={
                searching ? (
                  noResults('fabricante')
                ) : (
                  <ColumnEmpty
                    tone="info"
                    icon={<Building2 size={20} />}
                    title="O catálogo está vazio"
                    description={
                      canEdit
                        ? 'Comece cadastrando um fabricante (FICTÍCIO).'
                        : 'Peça a um administrador para cadastrar os guindastes.'
                    }
                    action={
                      canEdit && (
                        <Button
                          size="sm"
                          variant="primary"
                          icon={<Plus size={14} />}
                          onClick={() => setDrawer({ entity: 'manufacturer' })}
                        >
                          Cadastrar fabricante
                        </Button>
                      )
                    }
                  />
                )
              }
            />
            <CatalogColumn
              title="Guindastes"
              stamp="02"
              loading={loading}
              highlight={query}
              hasChildren
              selectedId={selection.selectedCraneId}
              onSelect={selection.onSelectCrane}
              items={
                filtered
                  ? cranesOf(filtered, selection.selectedManufacturerId).map((item) => ({
                      id: item.id,
                      label: item.modelName,
                      meta: plural(
                        configurationsOf(fullTree, item.id).length,
                        'configuração',
                        'configurações',
                      ),
                    }))
                  : []
              }
              actions={newButton(
                'Novo guindaste',
                manufacturer && { entity: 'crane', manufacturer },
              )}
              empty={
                manufacturer === null ? (
                  <ColumnEmpty
                    icon={<Construction size={20} />}
                    title="Escolha um fabricante"
                    description="Os guindastes dele aparecem aqui."
                  />
                ) : searching ? (
                  noResults('guindaste')
                ) : (
                  <ColumnEmpty
                    icon={<Construction size={20} />}
                    title={`${manufacturer.name} ainda não tem guindastes`}
                    action={
                      canEdit && (
                        <Button
                          size="sm"
                          icon={<Plus size={14} />}
                          onClick={() => setDrawer({ entity: 'crane', manufacturer })}
                        >
                          Cadastrar guindaste
                        </Button>
                      )
                    }
                  />
                )
              }
            />
            <CatalogColumn
              title="Configurações"
              stamp="03"
              loading={loading}
              highlight={query}
              selectedId={selection.selectedConfigurationId}
              onSelect={selection.onSelectConfiguration}
              items={
                filtered
                  ? configurationsOf(filtered, selection.selectedCraneId).map((item) => ({
                      id: item.id,
                      label: item.name,
                      badge:
                        item.geometry === null ? (
                          <Badge tone="warning" variant="outline">
                            sem ficha
                          </Badge>
                        ) : undefined,
                    }))
                  : []
              }
              actions={newButton('Nova configuração', crane && { entity: 'configuration', crane })}
              empty={
                crane === null ? (
                  <ColumnEmpty
                    icon={<Settings2 size={20} />}
                    title="Escolha um guindaste"
                    description="As configurações dele aparecem aqui."
                  />
                ) : searching ? (
                  noResults('configuração')
                ) : (
                  <ColumnEmpty
                    icon={<Settings2 size={20} />}
                    title={`${crane.modelName} ainda não tem configurações`}
                    action={
                      canEdit && (
                        <Button
                          size="sm"
                          icon={<Plus size={14} />}
                          onClick={() => setDrawer({ entity: 'configuration', crane })}
                        >
                          Cadastrar configuração
                        </Button>
                      )
                    }
                  />
                )
              }
            />
          </div>

          {configuration ? (
            <ConfigurationDetail
              manufacturer={manufacturer}
              crane={crane}
              configuration={configuration}
              versions={versions.state}
              activeChart={activeChart}
              canEdit={canEdit}
              onEdit={() =>
                crane &&
                setDrawer({
                  entity: 'configuration',
                  crane,
                  editing: configuration,
                  // Sem a lista carregada, não se sabe se há tabela ativa (o Drawer confirma).
                  ...(versions.state.status === 'loaded' && {
                    activeChartVersion: active?.version ?? null,
                    chartVersionCount: versions.state.versions.length,
                  }),
                })
              }
            />
          ) : (
            <Panel className={styles.detail}>
              <EmptyState
                compact
                tone="neutral"
                icon={<Settings2 size={22} />}
                title="Nenhuma configuração escolhida"
                description="Escolha fabricante, guindaste e configuração acima para ver a ficha técnica (a, h e limites) e a tabela de carga ativa."
                action={
                  canEdit &&
                  (crane && manufacturer ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDrawer({ entity: 'crane', manufacturer, editing: crane })}
                    >
                      Editar o guindaste {crane.modelName}
                    </Button>
                  ) : manufacturer ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDrawer({ entity: 'manufacturer', editing: manufacturer })}
                    >
                      Editar o fabricante {manufacturer.name}
                    </Button>
                  ) : undefined)
                }
              />
            </Panel>
          )}
        </>
      )}

      <CatalogEntityDrawer
        request={drawer}
        onClose={() => setDrawer(null)}
        onSaved={reload}
        {...mutations}
      />
    </Page>
  )
}
