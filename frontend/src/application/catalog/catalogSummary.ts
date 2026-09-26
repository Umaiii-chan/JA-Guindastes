// Resumo do catálogo para a página Início (TASK-039): quantos fabricantes, guindastes e configurações
// existem, e quantas configurações têm ficha técnica. O backend não tem rota de contagem: o resumo lê
// as listas (fabricantes → guindastes de cada um → configurações de cada guindaste), em paralelo.

import type { CatalogGateway } from './ports'

export interface CatalogSummary {
  readonly manufacturers: number
  readonly cranes: number
  readonly configurations: number
  /** Configurações com ficha técnica (as que a avaliação consegue usar). */
  readonly configurationsWithSheet: number
}

/** Rejeita com o `CatalogRequestError` da primeira lista que falhar. */
export async function loadCatalogSummary(
  gateway: Pick<CatalogGateway, 'listManufacturers' | 'listCranes' | 'listConfigurations'>,
): Promise<CatalogSummary> {
  const manufacturers = await gateway.listManufacturers()
  const craneLists = await Promise.all(
    manufacturers.map((manufacturer) => gateway.listCranes(manufacturer.id)),
  )
  const cranes = craneLists.flat()
  const configurationLists = await Promise.all(
    cranes.map((crane) => gateway.listConfigurations(crane.id)),
  )
  const configurations = configurationLists.flat()
  return {
    manufacturers: manufacturers.length,
    cranes: cranes.length,
    configurations: configurations.length,
    configurationsWithSheet: configurations.filter((item) => item.geometry !== null).length,
  }
}
