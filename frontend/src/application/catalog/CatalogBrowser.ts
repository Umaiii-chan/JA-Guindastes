// Seleção encadeada do catálogo (TASK-033; RF-010): fabricante → guindaste → configuração, e os
// cadastros que alimentam essas listas. Estado observável (`subscribe`/`getState`) para o React usar
// com `useSyncExternalStore`, como a `EvaluationSession`.
//
// Escolher um item recarrega a lista de baixo e limpa as seleções abaixo dele. Uma resposta que chega
// depois de a seleção mudar (ou de a mesma lista ser pedida de novo) é descartada, para a tela nunca
// mostrar os guindastes de um fabricante que já não está escolhido.

import {
  CatalogRequestError,
  type Crane,
  type CraneConfiguration,
  type CraneTechnicalSheet,
  type Manufacturer,
} from '../../domain/catalog/catalog'
import type { CatalogGateway, ConfigurationChanges } from './ports'

export type CatalogListStatus = 'idle' | 'loading' | 'loaded' | 'error'

export interface CatalogList<T> {
  readonly status: CatalogListStatus
  readonly items: readonly T[]
  /** Mensagem para a tela quando `status` é `error`. */
  readonly error: string | null
}

export interface CatalogBrowserState {
  readonly manufacturers: CatalogList<Manufacturer>
  readonly cranes: CatalogList<Crane>
  readonly configurations: CatalogList<CraneConfiguration>
  readonly selectedManufacturerId: string | null
  readonly selectedCraneId: string | null
  readonly selectedConfigurationId: string | null
}

/** Resultado de um cadastro: o registro criado (já selecionado) ou o erro, para o formulário. */
export type CatalogMutationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: CatalogRequestError }

const IDLE_LIST: CatalogList<never> = { status: 'idle', items: [], error: null }
const LOADING_LIST: CatalogList<never> = { status: 'loading', items: [], error: null }

const INITIAL_STATE: CatalogBrowserState = {
  manufacturers: IDLE_LIST,
  cranes: IDLE_LIST,
  configurations: IDLE_LIST,
  selectedManufacturerId: null,
  selectedCraneId: null,
  selectedConfigurationId: null,
}

type ListKey = 'manufacturers' | 'cranes' | 'configurations'

export class CatalogBrowser {
  private state: CatalogBrowserState = INITIAL_STATE
  private readonly listeners = new Set<() => void>()
  private readonly gateway: CatalogGateway
  /** Último pedido de cada lista; resposta de pedido anterior é descartada. */
  private readonly requestIds: Record<ListKey, number> = {
    manufacturers: 0,
    cranes: 0,
    configurations: 0,
  }

  constructor(gateway: CatalogGateway) {
    this.gateway = gateway
  }

  getState = (): CatalogBrowserState => this.state

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** Carrega (ou recarrega) a lista de fabricantes, mantendo as seleções. */
  loadManufacturers(): Promise<void> {
    return this.loadList('manufacturers', () => this.gateway.listManufacturers(), true)
  }

  /** Escolhe o fabricante (ou nenhum), limpa guindaste e configuração e carrega os guindastes dele. */
  selectManufacturer(manufacturerId: string | null): Promise<void> {
    this.setState({
      selectedManufacturerId: manufacturerId,
      selectedCraneId: null,
      selectedConfigurationId: null,
      configurations: IDLE_LIST,
    })
    this.requestIds.configurations += 1
    if (manufacturerId === null) {
      this.requestIds.cranes += 1
      this.setState({ cranes: IDLE_LIST })
      return Promise.resolve()
    }
    return this.loadList('cranes', () => this.gateway.listCranes(manufacturerId))
  }

  /** Escolhe o guindaste (ou nenhum), limpa a configuração e carrega as configurações dele. */
  selectCrane(craneId: string | null): Promise<void> {
    this.setState({ selectedCraneId: craneId, selectedConfigurationId: null })
    if (craneId === null) {
      this.requestIds.configurations += 1
      this.setState({ configurations: IDLE_LIST })
      return Promise.resolve()
    }
    return this.loadList('configurations', () => this.gateway.listConfigurations(craneId))
  }

  selectConfiguration(configurationId: string | null): void {
    this.setState({ selectedConfigurationId: configurationId })
  }

  /** Cadastra o fabricante, recarrega a lista e o deixa escolhido. */
  createManufacturer(name: string): Promise<CatalogMutationResult<Manufacturer>> {
    return this.mutate(
      () => this.gateway.createManufacturer(name),
      async (created) => {
        await this.loadManufacturers()
        await this.selectManufacturer(created.id)
      },
    )
  }

  /** Cadastra o guindaste no fabricante indicado, recarrega a lista e o deixa escolhido. */
  createCrane(manufacturerId: string, modelName: string): Promise<CatalogMutationResult<Crane>> {
    return this.mutate(
      () => this.gateway.createCrane({ manufacturerId, modelName }),
      async (created) => {
        if (this.state.selectedManufacturerId !== manufacturerId) return
        await this.loadList('cranes', () => this.gateway.listCranes(manufacturerId), true)
        if (this.state.selectedManufacturerId === manufacturerId) await this.selectCrane(created.id)
      },
    )
  }

  /** Cadastra a configuração no guindaste indicado, recarrega a lista e a deixa escolhida. */
  createConfiguration(
    craneId: string,
    name: string,
    geometry: CraneTechnicalSheet | null,
  ): Promise<CatalogMutationResult<CraneConfiguration>> {
    return this.mutate(
      () => this.gateway.createConfiguration(craneId, { name, geometry }),
      async (created) => {
        if (this.state.selectedCraneId !== craneId) return
        await this.loadList('configurations', () => this.gateway.listConfigurations(craneId), true)
        if (this.state.selectedCraneId === craneId) this.selectConfiguration(created.id)
      },
    )
  }

  /** Renomeia o fabricante (TASK-044) e recarrega a lista, mantendo a seleção. */
  updateManufacturer(
    manufacturerId: string,
    name: string,
  ): Promise<CatalogMutationResult<Manufacturer>> {
    return this.mutate(
      () => this.gateway.updateManufacturer(manufacturerId, name),
      () => this.loadManufacturers(),
    )
  }

  /** Renomeia o guindaste (TASK-044); recarrega os guindastes se o fabricante dele está escolhido. */
  updateCrane(craneId: string, modelName: string): Promise<CatalogMutationResult<Crane>> {
    return this.mutate(
      () => this.gateway.updateCrane(craneId, modelName),
      async (updated) => {
        const manufacturerId = updated.manufacturerId
        if (this.state.selectedManufacturerId !== manufacturerId) return
        await this.loadList('cranes', () => this.gateway.listCranes(manufacturerId), true)
      },
    )
  }

  /**
   * Altera o nome e/ou a ficha da configuração (TASK-044). A ficha nova vale para as próximas
   * avaliações; recarrega as configurações se o guindaste dela está escolhido.
   */
  updateConfiguration(
    configurationId: string,
    changes: ConfigurationChanges,
  ): Promise<CatalogMutationResult<CraneConfiguration>> {
    return this.mutate(
      () => this.gateway.updateConfiguration(configurationId, changes),
      async (updated) => {
        const craneId = updated.craneId
        if (this.state.selectedCraneId !== craneId) return
        await this.loadList('configurations', () => this.gateway.listConfigurations(craneId), true)
      },
    )
  }

  private async mutate<T>(
    create: () => Promise<T>,
    afterCreate: (created: T) => Promise<void>,
  ): Promise<CatalogMutationResult<T>> {
    let created: T
    try {
      created = await create()
    } catch (error) {
      return { ok: false, error: toCatalogError(error) }
    }
    await afterCreate(created)
    return { ok: true, value: created }
  }

  /**
   * Pede a lista. `keepItems`: ao recarregar a mesma lista (depois de um cadastro), os itens atuais
   * continuam visíveis enquanto a resposta não chega; ao trocar a seleção de cima, a lista esvazia.
   */
  private async loadList<K extends ListKey>(
    key: K,
    fetchItems: () => Promise<CatalogBrowserState[K]['items']>,
    keepItems = false,
  ): Promise<void> {
    this.requestIds[key] += 1
    const requestId = this.requestIds[key]
    this.setList(key, { ...LOADING_LIST, items: keepItems ? this.state[key].items : [] })
    try {
      const items = await fetchItems()
      if (requestId !== this.requestIds[key]) return
      this.setList(key, { status: 'loaded', items, error: null })
    } catch (error) {
      if (requestId !== this.requestIds[key]) return
      this.setList(key, { status: 'error', items: [], error: toCatalogError(error).message })
    }
  }

  private setList<K extends ListKey>(
    key: K,
    list: CatalogList<CatalogBrowserState[K]['items'][number]>,
  ): void {
    this.setState({ [key]: list } as Partial<CatalogBrowserState>)
  }

  private setState(patch: Partial<CatalogBrowserState>): void {
    this.state = { ...this.state, ...patch }
    for (const listener of this.listeners) listener()
  }
}

/** Configuração escolhida, se ela está na lista carregada. */
export function selectedConfiguration(state: CatalogBrowserState): CraneConfiguration | null {
  const { selectedConfigurationId, configurations } = state
  if (selectedConfigurationId === null) return null
  return configurations.items.find((item) => item.id === selectedConfigurationId) ?? null
}

function toCatalogError(error: unknown): CatalogRequestError {
  if (error instanceof CatalogRequestError) return error
  const message = error instanceof Error ? error.message : String(error)
  return new CatalogRequestError('HTTP_ERROR', `Falha inesperada no catálogo: ${message}`)
}
