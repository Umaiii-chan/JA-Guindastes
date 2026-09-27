// Campos da avaliação da TASK-046 (ADR-018), iguais no REST (`EvaluationResponse`) e no WebSocket
// (`simulation.evaluated`.payload): a zona de giro usada e as parcelas do peso comparado.
//
// - `rotation_zone_code` e `rotation_zone_name`: `str | null`;
// - `hook_block_weight_kg`: `float` (0 sem gancho);
// - `compared_weight_kg`: `float`, carga + gancho, o valor comparado com a capacidade.
//
// Ausentes (backend anterior à TASK-046) viram `null`: a tela mostra "—", sem inventar valor.

import { type JsonRecord, readNullableNumber, readNullableString } from './readJson'

export interface EvaluationZoneAndWeights {
  readonly rotationZoneCode: string | null
  readonly rotationZoneName: string | null
  readonly hookBlockWeightKg: number | null
  readonly comparedWeightKg: number | null
}

export function readZoneAndWeights(record: JsonRecord, path: string): EvaluationZoneAndWeights {
  return {
    rotationZoneCode: readNullableString(record, 'rotation_zone_code', path),
    rotationZoneName: readNullableString(record, 'rotation_zone_name', path),
    hookBlockWeightKg: readNullableNumber(record, 'hook_block_weight_kg', path),
    comparedWeightKg: readNullableNumber(record, 'compared_weight_kg', path),
  }
}
