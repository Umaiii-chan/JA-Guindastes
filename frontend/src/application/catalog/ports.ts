// Porta do catálogo (TASK-033): o que a seleção e os cadastros precisam do backend, sem saber que é
// `fetch` (implementação em `src/infrastructure/api/catalogRestClient.ts`).

import type {
  Crane,
  CraneConfiguration,
  CraneTechnicalSheet,
  Manufacturer,
} from '../../domain/catalog/catalog'

export interface NewCrane {
  readonly manufacturerId: string
  readonly modelName: string
}

export interface NewConfiguration {
  readonly name: string
  /** `null` cadastra a configuração sem ficha técnica (o backend aceita). */
  readonly geometry: CraneTechnicalSheet | null
}

/** Todas as operações rejeitam com um `CatalogRequestError`. */
export interface CatalogGateway {
  listManufacturers(): Promise<readonly Manufacturer[]>
  createManufacturer(name: string): Promise<Manufacturer>
  listCranes(manufacturerId: string): Promise<readonly Crane[]>
  createCrane(crane: NewCrane): Promise<Crane>
  listConfigurations(craneId: string): Promise<readonly CraneConfiguration[]>
  createConfiguration(craneId: string, configuration: NewConfiguration): Promise<CraneConfiguration>
}
