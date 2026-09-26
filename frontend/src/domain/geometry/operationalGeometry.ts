// Geometria operacional do ADR-013 (C-1 a C-5), calculada no navegador só para PRÉ-VISUALIZAÇÃO.
//
// O backend é a fonte de verdade desta geometria (ADR-013 C-7; RN-008): o `GeometryService` em
// `backend/app/domain/services/geometry_service.py` faz a mesma conta com a ficha técnica cadastrada,
// e é o valor dele que vale para a consulta à tabela, a capacidade e a segurança. Este módulo existe
// para mover o gancho na cena e mostrar um raio provisório; ele não decide capacidade nem segurança.
//
// Convenções (ADR-013): sistema destro, Y para cima, +Z para a frente do chassi, origem no encontro do
// eixo de giro com o plano de apoio; metros e graus nas interfaces, radianos só dentro do cálculo.
//
//   (1) alcance horizontal da ponta   R   = a + L·cos θ
//   (2) altura da ponta               y_T = h + L·sin θ
//   (3) altura do gancho              y_G = y_T − c
//   (4) raio de trabalho              working_radius = R
//   (5) P = (a·sin ψ, h, a·cos ψ);  T = (R·sin ψ, y_T, R·cos ψ);  G = (R·sin ψ, y_G, R·cos ψ)
//
// Valem as simplificações S-1 a S-8: sem deflexão da lança, cabo vertical, sem moitão, guindaste
// nivelado, lança reta sem jib. Vários itens são A VALIDAR com a empresa (G-1..G-8).
//
// Sem Three.js nem React (RNF-002): a UI pode importar os tipos daqui.

/**
 * Parâmetros geométricos do guindaste (ADR-013 C-4). Em produção vêm da ficha técnica cadastrada no
 * backend, nunca do modelo 3D (RN-003); na PoC são FICTÍCIOS.
 */
export interface CraneGeometryParameters {
  /**
   * a: distância horizontal do eixo de giro até o pino do pé da lança P, na direção da lança (m).
   * Tem sinal: positiva se P fica do lado da ponta, negativa se fica atrás do eixo; 0 é válido.
   */
  readonly boomPivotOffsetM: number
  /** h: altura do pino do pé da lança P acima do plano de apoio (m), ≥ 0. */
  readonly boomPivotHeightM: number
}

/** Entradas operacionais da geometria: L, θ, ψ e c (ADR-013 C-5), com os nomes do `CraneState`. */
export interface OperationalInputs {
  /** L: distância do pino do pé da lança até a ponta (m). */
  readonly boomLengthM: number
  /** θ: inclinação da lança sobre a horizontal (°); 0° horizontal, positivo com a ponta subindo. */
  readonly boomAngleDeg: number
  /** ψ: giro da torre (°); 0° com a lança para +Z, positivo no sentido anti-horário visto de cima. */
  readonly turretRotationDeg: number
  /** c: queda vertical da ponta até o gancho (m); não é o cabo desenrolado do guincho (S-4). */
  readonly cableLengthM: number
}

/** Ponto no referencial do guindaste, em metros (ADR-013 C-1): os mesmos eixos do glTF e do Three.js. */
export interface Point3 {
  readonly xM: number
  readonly yM: number
  readonly zM: number
}

/** Resultado das fórmulas (1)–(5) do ADR-013. Tudo geométrico, sem deflexão nem moitão (S-1, S-3). */
export interface OperationalGeometry {
  /** R da fórmula (1), com sinal: negativo quando a ponta fica atrás do eixo de giro. */
  readonly horizontalReachM: number
  /**
   * Raio de trabalho da fórmula (4), do eixo de giro até a vertical do gancho. `null` quando R < 0:
   * o estado está fora do domínio geométrico, e o raio não vira |R| (ADR-013 C-5).
   */
  readonly workingRadiusM: number | null
  /** y_T: altura da ponta em relação ao plano de apoio (m). */
  readonly tipHeightM: number
  /** y_G: altura do gancho em relação ao plano de apoio (m). Pode ser negativa (G-8). */
  readonly hookHeightM: number
  /** P: pino do pé da lança. */
  readonly boomPivot: Point3
  /** T: ponta da lança (eixo da polia da ponta). */
  readonly boomTip: Point3
  /** G: gancho (ponto de suspensão da carga), na vertical de T. */
  readonly hook: Point3
}

/**
 * Calcula a geometria operacional pelas fórmulas do ADR-013 C-5, para pré-visualização.
 *
 * Não compara as entradas com as faixas da ficha técnica: quem valida é o backend (RN-008), e na cena
 * o `CraneController` já limita (clamp) os comandos. Lança `RangeError` para número não finito e para
 * altura do pino negativa.
 */
export function calculateOperationalGeometry(
  inputs: OperationalInputs,
  parameters: CraneGeometryParameters,
): OperationalGeometry {
  validateCraneGeometryParameters(parameters)
  requireFinite('boomLengthM', inputs.boomLengthM)
  requireFinite('boomAngleDeg', inputs.boomAngleDeg)
  requireFinite('turretRotationDeg', inputs.turretRotationDeg)
  requireFinite('cableLengthM', inputs.cableLengthM)

  const reachM = horizontalReachM(inputs, parameters)
  const boomAngleRad = degreesToRadians(inputs.boomAngleDeg)
  const turretRotationRad = degreesToRadians(inputs.turretRotationDeg)

  const tipHeightM = parameters.boomPivotHeightM + inputs.boomLengthM * Math.sin(boomAngleRad) // (2)
  const hookHeightM = tipHeightM - inputs.cableLengthM // (3)

  // Direção horizontal da lança: u(ψ) = (sin ψ, 0, cos ψ) (ADR-013 C-2).
  const directionX = Math.sin(turretRotationRad)
  const directionZ = Math.cos(turretRotationRad)
  const offsetM = parameters.boomPivotOffsetM

  return {
    horizontalReachM: reachM,
    workingRadiusM: workingRadiusM(inputs, parameters),
    tipHeightM,
    hookHeightM,
    boomPivot: {
      xM: offsetM * directionX,
      yM: parameters.boomPivotHeightM,
      zM: offsetM * directionZ,
    },
    boomTip: { xM: reachM * directionX, yM: tipHeightM, zM: reachM * directionZ },
    hook: { xM: reachM * directionX, yM: hookHeightM, zM: reachM * directionZ },
  }
}

/**
 * Fórmula (4): a única definição do raio de trabalho (ADR-013 C-3), igual à do backend.
 *
 * Raio medido do eixo de giro até a vertical do gancho; com o cabo vertical (S-2), é o alcance
 * horizontal da ponta. A definição é A VALIDAR (G-1): se a empresa responder outra (por exemplo, raio
 * a partir do pino, alternativa A-1), muda só esta função (e a do backend).
 */
export function workingRadiusM(
  inputs: OperationalInputs,
  parameters: CraneGeometryParameters,
): number | null {
  const reachM = horizontalReachM(inputs, parameters)
  // ADR-013 C-5: com R < 0 o estado está fora do domínio geométrico; o raio não vira |R|.
  return reachM < 0 ? null : reachM
}

/** Rejeita parâmetros que o backend também rejeitaria: não finitos ou altura do pino negativa. */
export function validateCraneGeometryParameters(parameters: CraneGeometryParameters): void {
  requireFinite('boomPivotOffsetM', parameters.boomPivotOffsetM)
  requireFinite('boomPivotHeightM', parameters.boomPivotHeightM)
  if (parameters.boomPivotHeightM < 0) {
    throw new RangeError(
      `boomPivotHeightM: a altura do pino não pode ser negativa (recebido ${parameters.boomPivotHeightM}).`,
    )
  }
}

/** Fórmula (1): distância horizontal com sinal do eixo de giro até a ponta, R = a + L·cos θ. */
function horizontalReachM(inputs: OperationalInputs, parameters: CraneGeometryParameters): number {
  return (
    parameters.boomPivotOffsetM +
    inputs.boomLengthM * Math.cos(degreesToRadians(inputs.boomAngleDeg))
  )
}

function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

function requireFinite(name: string, value: number): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${name}: valor precisa ser um número finito (recebido ${value}).`)
  }
}
