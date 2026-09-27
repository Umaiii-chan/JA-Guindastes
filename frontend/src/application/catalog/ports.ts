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

/**
 * Alteração de uma configuração (TASK-044): só os campos presentes mudam, e ao menos um é
 * obrigatório. A ficha, quando presente, substitui a inteira e não pode ser removida (`null`).
 */
export interface ConfigurationChanges {
  readonly name?: string
  readonly geometry?: CraneTechnicalSheet
}

/** Todas as operações rejeitam com um `CatalogRequestError`. */
export interface CatalogGateway {
  listManufacturers(): Promise<readonly Manufacturer[]>
  createManufacturer(name: string): Promise<Manufacturer>
  updateManufacturer(manufacturerId: string, name: string): Promise<Manufacturer>
  listCranes(manufacturerId: string): Promise<readonly Crane[]>
  createCrane(crane: NewCrane): Promise<Crane>
  updateCrane(craneId: string, modelName: string): Promise<Crane>
  listConfigurations(craneId: string): Promise<readonly CraneConfiguration[]>
  createConfiguration(craneId: string, configuration: NewConfiguration): Promise<CraneConfiguration>
  updateConfiguration(
    configurationId: string,
    changes: ConfigurationChanges,
  ): Promise<CraneConfiguration>
}
