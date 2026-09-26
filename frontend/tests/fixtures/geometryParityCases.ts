// FICTÍCIO — casos de paridade da geometria do ADR-013 entre backend e frontend.
//
// Transcrição dos casos calculados à mão em `backend/tests/domain/test_geometry_service.py` (TASK-014),
// com os mesmos parâmetros de `backend/tests/fixtures/crane_geometry_ficticia.py`: mesmas entradas,
// mesmas saídas esperadas, em forma fechada (cos 30° = √3/2, sin 45° = √2/2...), sem repetir as chamadas
// de `Math` do código. Nenhum número vem de ficha técnica de fabricante nem da doc-fonte; não use estes
// valores fora dos testes (ADR-012; ADR-013 C-4, regra 2).
//
// Se um caso mudar no backend, mude aqui também. Um arquivo único lido pelos dois lados é pendência
// (ADR-013 C-7; handoff da TASK-016).

import type {
  CraneGeometryParameters,
  OperationalInputs,
  Point3,
} from '../../src/domain/geometry/operationalGeometry'

/**
 * Tolerância só para erro de ponto flutuante (ex.: cos 90° dá 6e-17, não 0), a mesma do backend
 * (`TOLERANCE_M = 1e-9`). Não é tolerância de engenharia entre cálculo e campo (ADR-013 G-7).
 */
export const PARITY_TOLERANCE_M = 1e-9

export const SQRT_2 = Math.sqrt(2)
export const SQRT_3 = Math.sqrt(3)

/** FICTÍCIO: a = 1,5 m e h = 2,5 m, como `build_crane_geometry_ficticia()` do backend. */
export const CRANE_GEOMETRY_FICTICIA: CraneGeometryParameters = {
  boomPivotOffsetM: 1.5,
  boomPivotHeightM: 2.5,
}

/** FICTÍCIO: estado padrão, como `state_ficticio()` do backend (L = 20 m, θ = 30°, ψ = 0°, c = 5 m). */
export const STATE_FICTICIO: OperationalInputs = {
  boomLengthM: 20,
  boomAngleDeg: 30,
  turretRotationDeg: 0,
  cableLengthM: 5,
}

export interface GeometryParityCase {
  /** Mesmo `id` do `pytest.param` no backend. */
  readonly id: string
  readonly parameters: CraneGeometryParameters
  readonly inputs: OperationalInputs
  readonly expected: {
    readonly workingRadiusM: number
    readonly boomPivot: Point3
    readonly boomTip: Point3
    readonly hook: Point3
  }
}

function point(xM: number, yM: number, zM: number): Point3 {
  return { xM, yM, zM }
}

function parityCase(
  id: string,
  parameterChanges: Partial<CraneGeometryParameters>,
  inputChanges: Partial<OperationalInputs>,
  workingRadiusM: number,
  boomPivot: Point3,
  boomTip: Point3,
  hook: Point3,
): GeometryParityCase {
  return {
    id,
    parameters: { ...CRANE_GEOMETRY_FICTICIA, ...parameterChanges },
    inputs: { ...STATE_FICTICIO, ...inputChanges },
    expected: { workingRadiusM, boomPivot, boomTip, hook },
  }
}

/** `test_ficticio_geometry_matches_hand_calculated_values` do backend, caso a caso. */
export const GEOMETRY_PARITY_CASES: readonly GeometryParityCase[] = [
  // R = 1,5 + 10·cos 0° = 11,5; y_T = 2,5 + 10·sin 0° = 2,5; y_G = 2,5 − 2 = 0,5.
  parityCase(
    'theta-0-lanca-horizontal',
    {},
    { boomLengthM: 10, boomAngleDeg: 0, cableLengthM: 2 },
    11.5,
    point(0, 2.5, 1.5),
    point(0, 2.5, 11.5),
    point(0, 0.5, 11.5),
  ),
  // R = 1,5 + 12·cos 90° = 1,5; y_T = 2,5 + 12 = 14,5; y_G = 14,5 − 4 = 10,5.
  parityCase(
    'theta-90-lanca-vertical',
    {},
    { boomLengthM: 12, boomAngleDeg: 90, cableLengthM: 4 },
    1.5,
    point(0, 2.5, 1.5),
    point(0, 14.5, 1.5),
    point(0, 10.5, 1.5),
  ),
  // R = 1,5 + 20·(√3/2) = 1,5 + 10√3; y_T = 2,5 + 20·(1/2) = 12,5; y_G = 12,5 − 5 = 7,5.
  parityCase(
    'theta-30',
    {},
    { boomLengthM: 20, boomAngleDeg: 30, cableLengthM: 5 },
    1.5 + 10 * SQRT_3,
    point(0, 2.5, 1.5),
    point(0, 12.5, 1.5 + 10 * SQRT_3),
    point(0, 7.5, 1.5 + 10 * SQRT_3),
  ),
  // R = 1,5 + 20·(1/2) = 11,5; y_T = 2,5 + 20·(√3/2) = 2,5 + 10√3; y_G = y_T − 5.
  parityCase(
    'theta-60',
    {},
    { boomLengthM: 20, boomAngleDeg: 60, cableLengthM: 5 },
    11.5,
    point(0, 2.5, 1.5),
    point(0, 2.5 + 10 * SQRT_3, 11.5),
    point(0, -2.5 + 10 * SQRT_3, 11.5),
  ),
  // ψ = 90°: u = (1, 0, 0), a lança sobre o lado esquerdo do chassi (+X).
  parityCase(
    'psi-90-lado-esquerdo',
    {},
    { boomLengthM: 10, boomAngleDeg: 0, turretRotationDeg: 90, cableLengthM: 2 },
    11.5,
    point(1.5, 2.5, 0),
    point(11.5, 2.5, 0),
    point(11.5, 0.5, 0),
  ),
  // ψ = 180°: u = (0, 0, −1), a lança sobre a traseira (−Z).
  parityCase(
    'psi-180-traseira',
    {},
    { boomLengthM: 10, boomAngleDeg: 0, turretRotationDeg: 180, cableLengthM: 2 },
    11.5,
    point(0, 2.5, -1.5),
    point(0, 2.5, -11.5),
    point(0, 0.5, -11.5),
  ),
  // ψ = 270°: u = (−1, 0, 0), a lança sobre o lado direito do chassi (−X).
  parityCase(
    'psi-270-lado-direito',
    {},
    { boomLengthM: 10, boomAngleDeg: 0, turretRotationDeg: 270, cableLengthM: 2 },
    11.5,
    point(-1.5, 2.5, 0),
    point(-11.5, 2.5, 0),
    point(-11.5, 0.5, 0),
  ),
  // ψ = 45°: u = (√2/2, 0, √2/2).
  parityCase(
    'psi-45',
    {},
    { boomLengthM: 10, boomAngleDeg: 0, turretRotationDeg: 45, cableLengthM: 2 },
    11.5,
    point(1.5 / SQRT_2, 2.5, 1.5 / SQRT_2),
    point(11.5 / SQRT_2, 2.5, 11.5 / SQRT_2),
    point(11.5 / SQRT_2, 0.5, 11.5 / SQRT_2),
  ),
  // a = −2 (pino atrás do eixo): R = −2 + 10 = 8; P = (0, 2,5, −2).
  parityCase(
    'a-negativo-psi-0',
    { boomPivotOffsetM: -2 },
    { boomLengthM: 10, boomAngleDeg: 0, cableLengthM: 2 },
    8,
    point(0, 2.5, -2),
    point(0, 2.5, 8),
    point(0, 0.5, 8),
  ),
  // a = −2 e ψ = 90°: P = (−2, 2,5, 0); G = (8, 0,5, 0).
  parityCase(
    'a-negativo-psi-90',
    { boomPivotOffsetM: -2 },
    { boomLengthM: 10, boomAngleDeg: 0, turretRotationDeg: 90, cableLengthM: 2 },
    8,
    point(-2, 2.5, 0),
    point(8, 2.5, 0),
    point(8, 0.5, 0),
  ),
  // Lança abaixo da horizontal (no backend, faixa FICTÍCIA com θ_min = −30°; h = 6):
  // R = 1,5 + 10·(√3/2) = 1,5 + 5√3; y_T = 6 − 10·(1/2) = 1; y_G = 1 − 0,5 = 0,5.
  parityCase(
    'theta-negativo',
    { boomPivotHeightM: 6 },
    { boomLengthM: 10, boomAngleDeg: -30, cableLengthM: 0.5 },
    1.5 + 5 * SQRT_3,
    point(0, 6, 1.5),
    point(0, 1, 1.5 + 5 * SQRT_3),
    point(0, 0.5, 1.5 + 5 * SQRT_3),
  ),
]
