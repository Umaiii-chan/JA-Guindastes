import { describe, expect, it } from 'vitest'

import {
  parseServerMessage,
  toStateChangedMessage,
} from '../../../src/infrastructure/websocket/evaluationMessages'
import {
  FICTICIO_INPUT,
  wsError,
  wsEvaluated,
  wsNotEvaluable,
} from '../../fixtures/evaluationResponses'

describe('mensagens do WebSocket de avaliação', () => {
  it('monta simulation.state.changed com o sequence e o payload do backend', () => {
    expect(toStateChangedMessage(7, FICTICIO_INPUT)).toEqual({
      type: 'simulation.state.changed',
      sequence: 7,
      payload: {
        configuration_id: 'CFG-FICTICIA-AVALIACAO',
        boom_length_m: 20,
        boom_angle_deg: 30,
        turret_rotation_deg: 0,
        cable_length_m: 1,
        load_weight_kg: 1500,
      },
    })
  })

  it('mapeia simulation.evaluated avaliado (queried_radius_m do WebSocket)', () => {
    expect(parseServerMessage(JSON.stringify(wsEvaluated(3)))).toEqual({
      kind: 'evaluated',
      sequence: 3,
      result: {
        kind: 'EVALUATED',
        workingRadiusM: 18.8205,
        hookHeightM: 11.5,
        capacity: {
          maximumCapacityKg: 2000,
          strategy: 'CONSERVATIVE_PROVISIONAL',
          queriedRadiusM: 18.8205,
          usedPoint: { boomLengthM: 20, workingRadiusM: 21.5, maxCapacityKg: 2000 },
        },
        utilizationPercent: 75,
        loadChartId: 'LC-FICTICIO-AVALIACAO-001',
        loadChartVersion: 'FICTICIO-AVALIACAO-v1',
        rotationZoneCode: null,
        rotationZoneName: null,
        tippingRisk: null,
        alerts: [],
        hookBlockWeightKg: null,
        comparedWeightKg: null,
        accessoriesWeightKg: null,
        accessories: [],
      },
    })
  })

  it('mapeia simulation.evaluated não avaliável, com os motivos sem categoria', () => {
    const message = parseServerMessage(JSON.stringify(wsNotEvaluable(4)))

    expect(message).toMatchObject({
      kind: 'evaluated',
      sequence: 4,
      result: {
        kind: 'NOT_EVALUABLE',
        capacity: null,
        reasons: [
          { code: 'CRANE_GEOMETRY_NOT_FOUND', category: null },
          { code: 'ACTIVE_LOAD_CHART_NOT_FOUND', category: null },
        ],
      },
    })
  })

  it('mapeia simulation.error com e sem sequence', () => {
    expect(parseServerMessage(JSON.stringify(wsError(5)))).toEqual({
      kind: 'error',
      sequence: 5,
      error: { code: 'INVALID_MESSAGE', message: 'Mensagem inválida.' },
    })
    expect(parseServerMessage(JSON.stringify(wsError(null, 'MALFORMED_MESSAGE')))).toMatchObject({
      kind: 'error',
      sequence: null,
      error: { code: 'MALFORMED_MESSAGE' },
    })
  })

  it.each([
    ['texto que não é JSON', 'isto não é json'],
    ['tipo desconhecido', JSON.stringify({ type: 'simulation.alert', sequence: 1 })],
    ['sequence fracionário', JSON.stringify(wsEvaluated(1.5))],
    ['sem payload', JSON.stringify({ type: 'simulation.evaluated', sequence: 1 })],
    [
      'motivo que não é texto',
      JSON.stringify({
        ...wsNotEvaluable(1),
        payload: { ...wsNotEvaluable(1).payload, reasons: [1] },
      }),
    ],
  ])('mensagem fora do contrato (%s) vira invalid, sem lançar', (_name, text) => {
    expect(parseServerMessage(text)).toMatchObject({
      kind: 'invalid',
      error: { code: 'INVALID_SERVER_MESSAGE' },
    })
  })
})
