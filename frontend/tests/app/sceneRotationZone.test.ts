// Zona destacada na cena do simulador (TASK-046): a do backend quando o resultado vale para o estado
// atual; senão, a prévia pelo giro ψ. Zonas e resultados FICTÍCIOS.

import { describe, expect, it } from 'vitest'

import { sceneRotationZoneCode } from '../../src/app/sceneRotationZone'
import { mapEvaluationResponse } from '../../src/infrastructure/api/evaluationRestClient'
import { ZONAS_FICTICIAS } from '../fixtures/catalogFicticio'
import { REST_EVALUATED, REST_EVALUATED_ZONA } from '../fixtures/evaluationResponses'

const FRONTAL_RESULT = mapEvaluationResponse(REST_EVALUATED_ZONA)

describe('sceneRotationZoneCode', () => {
  it('sem zonas, nada é destacado', () => {
    expect(
      sceneRotationZoneCode({
        zones: [],
        turretRotationDeg: 0,
        result: FRONTAL_RESULT,
        resultIsCurrent: true,
      }),
    ).toBeNull()
  })

  it('com resultado atual, vale a zona do backend (mesmo que ψ aponte para outra)', () => {
    expect(
      sceneRotationZoneCode({
        zones: ZONAS_FICTICIAS,
        turretRotationDeg: 180,
        result: FRONTAL_RESULT,
        resultIsCurrent: true,
      }),
    ).toBe('FRONTAL')
  })

  it('com resultado pendente ou sem zona informada, a prévia pelo ψ', () => {
    const base = { zones: ZONAS_FICTICIAS, turretRotationDeg: 180 }
    expect(sceneRotationZoneCode({ ...base, result: FRONTAL_RESULT, resultIsCurrent: false })).toBe(
      'LATERAL_TRASEIRA',
    )
    expect(
      sceneRotationZoneCode({
        ...base,
        result: mapEvaluationResponse(REST_EVALUATED),
        resultIsCurrent: true,
      }),
    ).toBe('LATERAL_TRASEIRA')
    expect(sceneRotationZoneCode({ ...base, result: null, resultIsCurrent: false })).toBe(
      'LATERAL_TRASEIRA',
    )
    expect(
      sceneRotationZoneCode({
        ...base,
        turretRotationDeg: null,
        result: null,
        resultIsCurrent: false,
      }),
    ).toBeNull()
  })

  it('zona do backend que a configuração não tem mais cai na prévia', () => {
    const stale = mapEvaluationResponse({ ...REST_EVALUATED_ZONA, rotation_zone_code: 'ANTIGA' })
    expect(
      sceneRotationZoneCode({
        zones: ZONAS_FICTICIAS,
        turretRotationDeg: 10,
        result: stale,
        resultIsCurrent: true,
      }),
    ).toBe('FRONTAL')
  })
})
