// Catálogo inteiro em árvore, para a página Catálogo (TASK-042): contagens em cada nível e busca que
// atravessa fabricante → guindaste → configuração. O backend não tem rota de árvore nem de contagem:
// lê as listas, como o resumo da página Início (`catalogSummary.ts`).

import type { Crane, CraneConfiguration, Manufacturer } from '../../domain/catalog/catalog'
import type { CatalogGateway } from './ports'

export interface CatalogTree {
  readonly manufacturers: readonly Manufacturer[]
  readonly cranesByManufacturer: ReadonlyMap<string, readonly Crane[]>
  readonly configurationsByCrane: ReadonlyMap<string, readonly CraneConfiguration[]>
}

/** Rejeita com o `CatalogRequestError` da primeira lista que falhar. */
export async function loadCatalogTree(
  gateway: Pick<CatalogGateway, 'listManufacturers' | 'listCranes' | 'listConfigurations'>,
): Promise<CatalogTree> {
  const manufacturers = await gateway.listManufacturers()
  const craneLists = await Promise.all(manufacturers.map((item) => gateway.listCranes(item.id)))
  const cranes = craneLists.flat()
  const configurationLists = await Promise.all(
    cranes.map((crane) => gateway.listConfigurations(crane.id)),
  )
  return {
    manufacturers,
    cranesByManufacturer: new Map(manufacturers.map((item, index) => [item.id, craneLists[index]])),
    configurationsByCrane: new Map(
      cranes.map((crane, index) => [crane.id, configurationLists[index]]),
    ),
  }
}

export function cranesOf(tree: CatalogTree, manufacturerId: string | null): readonly Crane[] {
  return manufacturerId === null ? [] : (tree.cranesByManufacturer.get(manufacturerId) ?? [])
}

export function configurationsOf(
  tree: CatalogTree,
  craneId: string | null,
): readonly CraneConfiguration[] {
  return craneId === null ? [] : (tree.configurationsByCrane.get(craneId) ?? [])
}

/** Quantas configurações o fabricante tem, somando os guindastes dele. */
export function configurationCountOf(tree: CatalogTree, manufacturerId: string): number {
  return cranesOf(tree, manufacturerId).reduce(
    (total, crane) => total + configurationsOf(tree, crane.id).length,
    0,
  )
}

/** Texto para comparar sem maiúsculas nem acentos. */
export function normalizeSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}

/**
 * Filtra a árvore pela busca. Um item fica visível quando o nome dele contém o termo, quando um
 * ancestral contém (mostra tudo abaixo dele) ou quando um descendente contém (mostra o caminho até
 * ele). Busca vazia devolve a árvore inteira.
 */
export function filterCatalogTree(tree: CatalogTree, query: string): CatalogTree {
  const term = normalizeSearch(query)
  if (term === '') return tree
  const matches = (text: string) => normalizeSearch(text).includes(term)

  const manufacturers: Manufacturer[] = []
  const cranesByManufacturer = new Map<string, readonly Crane[]>()
  const configurationsByCrane = new Map<string, readonly CraneConfiguration[]>()

  for (const manufacturer of tree.manufacturers) {
    const manufacturerMatches = matches(manufacturer.name)
    const cranes: Crane[] = []
    for (const crane of cranesOf(tree, manufacturer.id)) {
      const craneMatches = manufacturerMatches || matches(crane.modelName)
      const configurations = configurationsOf(tree, crane.id).filter(
        (configuration) => craneMatches || matches(configuration.name),
      )
      if (craneMatches || configurations.length > 0) {
        cranes.push(crane)
        configurationsByCrane.set(crane.id, configurations)
      }
    }
    if (manufacturerMatches || cranes.length > 0) {
      manufacturers.push(manufacturer)
      cranesByManufacturer.set(manufacturer.id, cranes)
    }
  }
  return { manufacturers, cranesByManufacturer, configurationsByCrane }
}

export interface CatalogTreeCounts {
  readonly manufacturers: number
  readonly cranes: number
  readonly configurations: number
}

export function countCatalogTree(tree: CatalogTree): CatalogTreeCounts {
  const cranes = tree.manufacturers.flatMap((item) => cranesOf(tree, item.id))
  return {
    manufacturers: tree.manufacturers.length,
    cranes: cranes.length,
    configurations: cranes.reduce(
      (total, crane) => total + configurationsOf(tree, crane.id).length,
      0,
    ),
  }
}
