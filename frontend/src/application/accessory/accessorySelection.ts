// Cadeia de acessórios escolhida na simulação (TASK-056): lista de ids na ordem gancho → carga.
// Funções puras, sem React nem rede. O mesmo id pode entrar mais de uma vez (duas lingas iguais).

import {
  type Accessory,
  accessoriesRiggingHeightM,
  accessoriesWeightKg,
  MAX_SELECTED_ACCESSORIES,
} from '../../domain/accessory/accessory'

export type AccessoryIds = readonly string[]

/** Põe `id` no fim da cadeia; no limite do backend, devolve a mesma lista. */
export function addAccessory(ids: AccessoryIds, id: string): AccessoryIds {
  if (id.trim() === '' || ids.length >= MAX_SELECTED_ACCESSORIES) return ids
  return [...ids, id]
}

/** Tira o acessório da posição `index`; índice fora da lista devolve a mesma lista. */
export function removeAccessoryAt(ids: AccessoryIds, index: number): AccessoryIds {
  if (!Number.isInteger(index) || index < 0 || index >= ids.length) return ids
  return ids.filter((_, position) => position !== index)
}

export interface ResolvedAccessories {
  /** Acessórios do catálogo, na ordem da cadeia. */
  readonly accessories: readonly Accessory[]
  /** Ids escolhidos que o catálogo atual não tem (por exemplo, apagados por um administrador). */
  readonly unknownIds: readonly string[]
  /** Soma de `riggingHeightM`: quanto a carga desce abaixo do gancho (m). */
  readonly riggingHeightM: number
  /** Soma dos pesos (kg), só para mostrar: o backend é quem compara com a capacidade (RN-008). */
  readonly weightKg: number
}

export function resolveAccessories(
  ids: AccessoryIds,
  catalog: readonly Accessory[],
): ResolvedAccessories {
  const byId = new Map(catalog.map((item) => [item.id, item]))
  const accessories: Accessory[] = []
  const unknownIds: string[] = []
  for (const id of ids) {
    const found = byId.get(id)
    if (found) accessories.push(found)
    else unknownIds.push(id)
  }
  return {
    accessories,
    unknownIds,
    riggingHeightM: accessoriesRiggingHeightM(accessories),
    weightKg: accessoriesWeightKg(accessories),
  }
}
