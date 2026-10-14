import { describe, expect, it } from 'vitest'

import {
  calculateOperationalGeometry,
  type CraneGeometryParameters,
  type OperationalInputs,
  validateCraneGeometryParameters,
  workingRadiusM,
} from '../../../src/domain/geometry/operationalGeometry'
import {
  CRANE_GEOMETRY_FICTICIA,
  GEOMETRY_PARITY_CASES,
  PARITY_TOLERANCE_M,
  STATE_FICTICIO,
} from '../../fixtures/geometryParityCases'
import { expectClose, expectXyzClose, xyz } from '../../helpers/expectClose'

// Paridade com `backend/tests/domain/test_geometry_service.py` (ADR-013 C-7; R-5): mesmos casos,
// mesmos parâmetros FICTÍCIOS e mesma tolerância. Os testes do backend sobre as faixas da ficha técnica
// (estado fora dos limites, limites inclusivos, arco de giro) não são repetidos aqui de propósito: quem
// valida é o backend (RN-008), e o frontend só calcula para pré-visualização.

function calculateFicticio(
  inputChanges: Partial<OperationalInputs> = {},
  parameterChanges: Partial<CraneGeometryParameters> = {},
) {
  return calculateOperationalGeometry(
    { ...STATE_FICTICIO, ...inputChanges },
    { ...CRANE_GEOMETRY_FICTICIA, ...parameterChanges },
  )
}

describe('calculateOperationalGeometry (ADR-013 C-5, parâmetros FICTÍCIOS)', () => {
  describe('paridade com os casos calculados à mão no servidor', () => {
    it.each(GEOMETRY_PARITY_CASES)('$id', ({ parameters, inputs, expected }) => {
      const result = calculateOperationalGeometry(inputs, parameters)

      expect(result.workingRadiusM).not.toBeNull()
      expectClose(result.workingRadiusM!, expected.workingRadiusM, PARITY_TOLERANCE_M, 'raio')
      expectClose(result.horizontalReachM, expected.workingRadiusM, PARITY_TOLERANCE_M, 'R')
      expectXyzClose(xyz(result.boomPivot), xyz(expected.boomPivot), PARITY_TOLERANCE_M, 'P')
      expectXyzClose(xyz(result.boomTip), xyz(expected.boomTip), PARITY_TOLERANCE_M, 'T')
      expectXyzClose(xyz(result.hook), xyz(expected.hook), PARITY_TOLERANCE_M, 'G')
      expectClose(result.tipHeightM, expected.boomTip.yM, PARITY_TOLERANCE_M, 'y_T')
      expectClose(result.hookHeightM, expected.hook.yM, PARITY_TOLERANCE_M, 'y_G')
    })
  })

  it('mede o raio a partir do eixo de giro, e não do pino', () => {
    // ADR-013 C-3: R = a + L·cos θ (e não L·cos θ, alternativa A-1).
    // a = 1,5; L = 20; θ = 60° → R = 1,5 + 10 = 11,5 (a partir do pino seria 10).
    const result = calculateFicticio({ boomLengthM: 20, boomAngleDeg: 60 })

    expectClose(result.workingRadiusM!, 11.5, PARITY_TOLERANCE_M)
  })

  it('o raio não depende do giro da torre', () => {
    const radii = [0, 45, 90, 180, 270].map(
      (psi) => calculateFicticio({ turretRotationDeg: psi }).workingRadiusM!,
    )

    for (const radius of radii) expectClose(radius, radii[0], PARITY_TOLERANCE_M)
  })

  it('ψ = 90° deixa a lança sobre o lado esquerdo do chassi (+X)', () => {
    // ADR-013 C-2.
    const { hook } = calculateFicticio({ turretRotationDeg: 90 })

    expect(hook.xM).toBeGreaterThan(0)
    expectClose(hook.zM, 0, PARITY_TOLERANCE_M)
  })

  it('ψ = 0° aponta a lança para a frente do chassi (+Z)', () => {
    const { hook } = calculateFicticio({ turretRotationDeg: 0 })

    expect(hook.zM).toBeGreaterThan(0)
    expectClose(hook.xM, 0, PARITY_TOLERANCE_M)
  })

  it('giro positivo é anti-horário visto de cima', () => {
    // Regra da mão direita em torno de +Y (para cima): uma rotação é anti-horária vista de cima
    // quando a componente Y de (antes × depois) é positiva. Com antes = (x0, z0) e depois = (x1, z1)
    // no plano XZ, essa componente é z0·x1 − x0·z1.
    const before = calculateFicticio({ turretRotationDeg: 0 }).hook
    const after = calculateFicticio({ turretRotationDeg: 30 }).hook

    const crossY = before.zM * after.xM - before.xM * after.zM

    expect(crossY).toBeGreaterThan(0)
  })

  it('o gancho pende na vertical da ponta, c metros abaixo', () => {
    // ADR-013 S-2: cabo vertical; G fica exatamente abaixo de T (fórmula 3).
    const result = calculateFicticio({ turretRotationDeg: 123, cableLengthM: 7 })

    expect(result.hook.xM).toBe(result.boomTip.xM)
    expect(result.hook.zM).toBe(result.boomTip.zM)
    expectClose(result.tipHeightM - result.hookHeightM, 7, PARITY_TOLERANCE_M)
  })

  it('ponta exatamente sobre o eixo de giro tem raio zero (limite, não R < 0)', () => {
    // a = 0 e θ = 90°: R = 0 + L·cos 90° = 0.
    const result = calculateFicticio({ boomAngleDeg: 90 }, { boomPivotOffsetM: 0 })

    expect(result.workingRadiusM).not.toBeNull()
    expectClose(result.workingRadiusM!, 0, PARITY_TOLERANCE_M)
  })

  it('gancho abaixo do plano de apoio não é bloqueado', () => {
    // ADR-013 C-5 (G-8): y_G = 2,5 + 10·sin 0° − 5 = −2,5.
    const result = calculateFicticio({ boomLengthM: 10, boomAngleDeg: 0, cableLengthM: 5 })

    expectClose(result.hookHeightM, -2.5, PARITY_TOLERANCE_M)
  })

  it('reproduz o raio do exemplo da doc-fonte com o pino sobre o eixo (só o raio)', () => {
    // ADR-013 "Verificação numérica": L = 18,2 m, θ = 42°, a = 0 → R = 18,2·cos 42° = 13,5252 m,
    // que a doc-fonte mostra como 13,5 m. A altura do gancho do exemplo (11,7 m) NÃO é testada: ela é
    // inconsistente com as fórmulas (ADR-013, risco R-4).
    const result = calculateFicticio(
      { boomLengthM: 18.2, boomAngleDeg: 42, turretRotationDeg: 120, cableLengthM: 8.4 },
      { boomPivotOffsetM: 0 },
    )

    expectClose(result.workingRadiusM!, 13.5252, 1e-4)
    expect(Math.round(result.workingRadiusM! * 10) / 10).toBe(13.5)
    // Coordenadas horizontais do gancho, também da verificação do ADR: x = 11,713; z = −6,763.
    expectClose(result.hook.xM, 11.713, 1e-3)
    expectClose(result.hook.zM, -6.763, 1e-3)
  })

  describe('ponta atrás do eixo de giro (R < 0)', () => {
    // a = −2; L = 12; θ = 90° → R = −2 + 12·cos 90° = −2. No backend, `OutsideGeometricDomainError`.
    const inputs = { ...STATE_FICTICIO, boomLengthM: 12, boomAngleDeg: 90 }
    const parameters = { ...CRANE_GEOMETRY_FICTICIA, boomPivotOffsetM: -2 }

    it('sinaliza fora do domínio geométrico: raio null, sem virar |R|', () => {
      const result = calculateOperationalGeometry(inputs, parameters)

      expect(result.workingRadiusM).toBeNull()
      expect(workingRadiusM(inputs, parameters)).toBeNull()
      expectClose(result.horizontalReachM, -2, PARITY_TOLERANCE_M)
    })

    it('continua dando as posições pela fórmula (5), para a cena', () => {
      const result = calculateOperationalGeometry(inputs, parameters)

      expectXyzClose(xyz(result.boomTip), [0, 14.5, -2], PARITY_TOLERANCE_M)
      expectXyzClose(xyz(result.hook), [0, 9.5, -2], PARITY_TOLERANCE_M)
    })
  })

  it.each([
    [-45, 315],
    [725, 5],
    [-180, 180],
  ])('o giro %s° dá a mesma geometria que %s° (sem normalizar o estado)', (psi, equivalent) => {
    const result = calculateFicticio({ turretRotationDeg: psi })
    const reference = calculateFicticio({ turretRotationDeg: equivalent })

    expectXyzClose(xyz(result.hook), xyz(reference.hook), PARITY_TOLERANCE_M)
    expectXyzClose(xyz(result.boomPivot), xyz(reference.boomPivot), PARITY_TOLERANCE_M)
  })

  describe('entradas inválidas', () => {
    it.each(['boomLengthM', 'boomAngleDeg', 'turretRotationDeg', 'cableLengthM'] as const)(
      'rejeita %s não finito',
      (key) => {
        for (const value of [NaN, Infinity, -Infinity]) {
          expect(() => calculateFicticio({ [key]: value })).toThrow(RangeError)
        }
      },
    )

    it.each([
      { boomPivotOffsetM: NaN },
      { boomPivotHeightM: Infinity },
      { boomPivotHeightM: -0.1 },
    ])('rejeita parâmetros geométricos inválidos %o', (changes) => {
      expect(() => calculateFicticio({}, changes)).toThrow(RangeError)
      expect(() =>
        validateCraneGeometryParameters({ ...CRANE_GEOMETRY_FICTICIA, ...changes }),
      ).toThrow(RangeError)
    })

    it('aceita pino atrás do eixo (a < 0) e pino no chão (h = 0)', () => {
      expect(() =>
        validateCraneGeometryParameters({ boomPivotOffsetM: -3, boomPivotHeightM: 0 }),
      ).not.toThrow()
    })
  })
})
