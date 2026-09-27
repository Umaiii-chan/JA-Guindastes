// Porta do catálogo (TASK-033): o que a seleção e os cadastros precisam do backend, sem saber que é
// `fetch` (implementação em `src/infrastructure/api/catalogRestClient.ts`).

import type {
  Crane,
  CraneConfiguration,
  CraneTechnicalSheet,
  Manufacturer,
  RotationZone,
} from '../../domain/catalog/catalog'

export interface NewCrane {
  readonly manufacturerId: string
  readonly modelName: string
}

export interface NewConfiguration {
  readonly name: string
  /** `null` cadastra a configuração sem ficha técnica (o backend aceita). */
  readonly geometry: CraneTechnicalSheet | null
  /** Zonas de giro (ADR-018); ausente ou vazia = sem zonas. */
  readonly rotationZones?: readonly RotationZone[]
  /** Peso do gancho (kg); ausente ou `null` = não informado. */
  readonly hookBlockWeightKg?: number | null
}

/**
 * Alteração de uma configuração (TASK-044): só os campos presentes mudam, e ao menos um é
 * obrigatório. A ficha, quando presente, substitui a inteira e não pode ser removida (`null`).
 */
export interface ConfigurationChanges {
  readonly name?: string
  readonly geometry?: CraneTechnicalSheet
  /** Substitui a lista de zonas (TASK-046); vazia remove as zonas (vai como `null`). */
  readonly rotationZones?: readonly RotationZone[]
  /** Peso do gancho (kg); `null` apaga o valor (conta como 0). */
  readonly hookBlockWeightKg?: number | null
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
