// Campos de acessórios da avaliação (TASK-056; RN-014), iguais no REST (`EvaluationResponse`) e no
// WebSocket (`simulation.evaluated`.payload):
//
// - `accessories_weight_kg`: soma dos pesos dos acessórios enviados, ou `null` sem acessórios;
// - `accessories`: lista de `{id, name, weight_kg}`, na ordem enviada.
//
// Ausentes (backend anterior à TASK-056) viram `null` e lista vazia.

import type { EvaluatedAccessory } from '../../domain/evaluation/evaluation'
import { type JsonRecord, readNullableNumber, readNumber, readRecord, readString } from './readJson'

export interface EvaluationAccessories {
  readonly accessoriesWeightKg: number | null
  readonly accessories: readonly EvaluatedAccessory[]
}

export function readAccessories(record: JsonRecord, path: string): EvaluationAccessories {
  const raw = record.accessories
  const items: readonly unknown[] = Array.isArray(raw) ? (raw as unknown[]) : []
  return {
    accessoriesWeightKg: readNullableNumber(record, 'accessories_weight_kg', path),
    accessories: items.map((item, index): EvaluatedAccessory => {
      const itemPath = `${path}.accessories[${index}]`
      const accessory = readRecord(item, itemPath)
      return {
        id: readString(accessory, 'id', itemPath),
        name: readString(accessory, 'name', itemPath),
        weightKg: readNumber(accessory, 'weight_kg', itemPath),
      }
    }),
  }
}
