// Área de operação verde, amarela e vermelha (TASK-055; ADR-025; RN-011), como a tela a recebe.
//
// É o resultado do BACKEND (`POST /api/v1/configurations/{id}/operating-area`): uma grade polar de
// células (giro ψ × raio R). O frontend só desenha; a regra de cada cor é do backend (RN-008).

/** Nível de uma célula: vermelho = acima do limite do modelo ou fora da tabela. */
export type OperatingAreaLevel = 'GREEN' | 'YELLOW' | 'RED'

export interface OperatingAreaCell {
  /** Giro da torre ψ, em graus, em [0°, 360°) (ADR-013 C-2). */
  readonly psiDeg: number
  /** Raio de trabalho R, em metros, do eixo de giro. */
  readonly radiusM: number
  readonly level: OperatingAreaLevel
}

export interface OperatingArea {
  readonly configurationId: string
  readonly boomLengthM: number
  readonly loadWeightKg: number
  readonly comparedWeightKg: number
  /** Passos da grade; cada célula cobre o passo centrado no seu ψ e R. */
  readonly psiStepDeg: number
  readonly radiusStepM: number
  readonly maxRadiusM: number
  readonly cells: readonly OperatingAreaCell[]
}

/** Parâmetros do pedido: lança e carga; os passos usam o padrão do backend (10° e 1 m). */
export interface OperatingAreaRequest {
  readonly configurationId: string
  readonly boomLengthM: number
  readonly loadWeightKg: number
  readonly psiStepDeg?: number
  readonly radiusStepM?: number
}
