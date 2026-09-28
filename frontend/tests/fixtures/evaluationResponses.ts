// FICTÍCIO: respostas no formato do backend (TASK-024 e TASK-025), com os números do exemplo do
// handoff da TASK-024. Não são de nenhum guindaste nem tabela real.

import type { EvaluationInput } from '../../src/domain/evaluation/evaluation'

export const FICTICIO_INPUT: EvaluationInput = {
  configurationId: 'CFG-FICTICIA-AVALIACAO',
  boomLengthM: 20,
  boomAngleDeg: 30,
  turretRotationDeg: 0,
  cableLengthM: 1,
  loadWeightKg: 1500,
}

const GEOMETRY = {
  working_radius_m: 18.8205,
  tip_height_m: 12.5,
  hook_height_m: 11.5,
  boom_pivot: { x_m: 0, y_m: 2.5, z_m: 1.5 },
  boom_tip: { x_m: 0, y_m: 12.5, z_m: 18.8205 },
  hook: { x_m: 0, y_m: 11.5, z_m: 18.8205 },
}

const USED_POINT = { boom_length_m: 20, working_radius_m: 21.5, max_capacity_kg: 2000 }

/** `POST /api/v1/evaluations` 200, avaliado (saída real do teste da TASK-024). */
export const REST_EVALUATED = {
  status: 'EVALUATED',
  configuration_id: 'CFG-FICTICIA-AVALIACAO',
  geometry: GEOMETRY,
  capacity: {
    maximum_capacity_kg: 2000,
    strategy: 'CONSERVATIVE_PROVISIONAL',
    queried_boom_length_m: 20,
    queried_working_radius_m: 18.8205,
    used_point: USED_POINT,
  },
  utilization_percent: 75,
  load_chart_id: 'LC-FICTICIO-AVALIACAO-001',
  load_chart_version: 'FICTICIO-AVALIACAO-v1',
  reasons: [],
}

/** `POST /api/v1/evaluations` 200, não avaliável (composição sem repositórios, TASK-024). */
export const REST_NOT_EVALUABLE = {
  status: 'NOT_EVALUABLE',
  configuration_id: 'CFG-FICTICIA-AVALIACAO',
  geometry: null,
  capacity: null,
  utilization_percent: null,
  load_chart_id: null,
  load_chart_version: null,
  reasons: [
    { code: 'CRANE_GEOMETRY_NOT_FOUND', category: 'EVALUATION' },
    { code: 'ACTIVE_LOAD_CHART_NOT_FOUND', category: 'EVALUATION' },
  ],
}

/** `simulation.evaluated`, avaliado (TASK-025). */
export function wsEvaluated(sequence: number, utilizationPercent = 75) {
  return {
    type: 'simulation.evaluated',
    sequence,
    payload: {
      result: 'EVALUATED',
      geometry: GEOMETRY,
      capacity: {
        maximum_capacity_kg: 2000,
        strategy: 'CONSERVATIVE_PROVISIONAL',
        queried_radius_m: 18.8205,
        used_point: USED_POINT,
      },
      utilization_percent: utilizationPercent,
      load_chart_id: 'LC-FICTICIO-AVALIACAO-001',
      load_chart_version: 'FICTICIO-AVALIACAO-v1',
      reasons: [],
    },
  }
}

/** `simulation.evaluated`, não avaliável (TASK-025). */
export function wsNotEvaluable(sequence: number) {
  return {
    type: 'simulation.evaluated',
    sequence,
    payload: {
      result: 'NOT_EVALUABLE',
      geometry: null,
      capacity: null,
      load_chart_id: null,
      load_chart_version: null,
      reasons: ['CRANE_GEOMETRY_NOT_FOUND', 'ACTIVE_LOAD_CHART_NOT_FOUND'],
    },
  }
}

/** `simulation.error` (TASK-025). */
export function wsError(sequence: number | null, code = 'INVALID_MESSAGE') {
  return {
    type: 'simulation.error',
    sequence,
    payload: {
      code,
      message: 'Mensagem inválida.',
      errors: [
        {
          location: ['payload', 'load_weight_kg'],
          message: 'ge 0',
          error_type: 'greater_than_equal',
        },
      ],
    },
  }
}

/**
 * TASK-046 (ADR-018): avaliado numa zona de giro, com o gancho FICTÍCIO somado à carga. 1500 kg de
 * carga + 180 kg de gancho = 1680 kg comparados com 2000 kg → 84 %.
 */
export const REST_EVALUATED_ZONA = {
  ...REST_EVALUATED,
  utilization_percent: 84,
  rotation_zone_code: 'FRONTAL',
  rotation_zone_name: 'Frontal FICTÍCIA',
  hook_block_weight_kg: 180,
  compared_weight_kg: 1680,
}

/** TASK-046: zona sem tabela ativa → não avaliável, com a zona informada. */
export const REST_NOT_EVALUABLE_ZONA = {
  ...REST_NOT_EVALUABLE,
  reasons: [{ code: 'ACTIVE_LOAD_CHART_NOT_FOUND', category: 'EVALUATION' }],
  rotation_zone_code: 'LATERAL_TRASEIRA',
  rotation_zone_name: 'Lateral e traseira FICTÍCIA',
  hook_block_weight_kg: 180,
  compared_weight_kg: 1680,
}

/** TASK-046: `simulation.evaluated` com zona e parcelas. */
export function wsEvaluatedZona(sequence: number) {
  const message = wsEvaluated(sequence, 84)
  return {
    ...message,
    payload: {
      ...message.payload,
      rotation_zone_code: 'LATERAL_TRASEIRA',
      rotation_zone_name: 'Lateral e traseira FICTÍCIA',
      hook_block_weight_kg: 180,
      compared_weight_kg: 1680,
    },
  }
}
