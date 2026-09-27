// Catálogo de guindastes visto pelo frontend (TASK-033): fabricante → guindaste → configuração, com a
// ficha técnica geométrica do ADR-013 C-4. Os dados vêm do backend (cadastros REST da TASK-030); aqui
// só há os tipos e o erro das requisições, sem regra de negócio.

export interface Manufacturer {
  readonly id: string
  readonly name: string
}

export interface Crane {
  readonly id: string
  readonly manufacturerId: string
  readonly modelName: string
}

/**
 * Ficha técnica geométrica da configuração (ADR-013 C-4), em metros e graus (RN-006). É com ela que o
 * backend valida e calcula (RN-008); no frontend, só define os limites dos sliders e os parâmetros a
 * e h da PRÉ-VISUALIZAÇÃO. Campos opcionais ausentes são `null`: sem c_max o cabo não tem máximo
 * cadastrado; sem ψ_min/ψ_max o giro é contínuo.
 */
export interface CraneTechnicalSheet {
  /** a: distância horizontal com sinal do eixo de giro até o pino do pé da lança P. */
  readonly boomPivotOffsetM: number
  /** h: altura de P acima do plano de apoio. */
  readonly boomPivotHeightM: number
  readonly boomLengthMinM: number
  readonly boomLengthMaxM: number
  readonly boomAngleMinDeg: number
  readonly boomAngleMaxDeg: number
  readonly cableLengthMinM: number
  readonly cableLengthMaxM: number | null
  readonly turretRotationMinDeg: number | null
  readonly turretRotationMaxDeg: number | null
}

/**
 * Zona de giro da configuração (ADR-018; TASK-046). Os ângulos seguem a convenção de ψ do ADR-013
 * (0° = lança sobre a frente, 90° = lado esquerdo, anti-horário visto de cima), em [0°, 360°): o
 * setor vai de `startDeg` a `endDeg` no sentido crescente e pode passar por 0° (ex.: 305° → 55°).
 */
export interface RotationZone {
  /** Único na configuração: 1 a 32 caracteres `[A-Z0-9_]`. */
  readonly code: string
  readonly name: string
  readonly startDeg: number
  readonly endDeg: number
}

export interface CraneConfiguration {
  readonly id: string
  readonly craneId: string
  readonly name: string
  /** `null` quando a configuração foi cadastrada sem ficha técnica. */
  readonly geometry: CraneTechnicalSheet | null
  /**
   * Zonas de giro (ADR-018), cada uma com a sua tabela ativa. Vazia = sem zonas: uma tabela vale
   * para todo o giro, como antes. Ausente conta como vazia (respostas anteriores à TASK-046).
   */
  readonly rotationZones?: readonly RotationZone[]
  /** Peso do gancho que a tabela considera (kg); `null` ou ausente = não informado (conta como 0). */
  readonly hookBlockWeightKg?: number | null
}

/** Códigos de erro do backend para as zonas na configuração (TASK-046 § 3). */
export const ROTATION_ZONE_IN_USE = 'ROTATION_ZONE_IN_USE'
export const INVALID_ROTATION_ZONES = 'INVALID_ROTATION_ZONES'

export type CatalogErrorCode =
  'NOT_FOUND' | 'CONFLICT' | 'VALIDATION' | 'HTTP_ERROR' | 'NETWORK_ERROR' | 'INVALID_RESPONSE'

/**
 * Erro de um campo apontado pelo backend (422). `field` é o caminho do campo no pedido, com os nomes
 * do frontend: `name`, `modelName`, `manufacturerId`, `geometry` (a ficha inteira) ou
 * `geometry.<campo da ficha>` (ex.: `geometry.boomLengthMinM`). Vazio quando o backend não diz.
 */
export interface CatalogFieldError {
  readonly field: string
  readonly message: string
}

/** Falha numa requisição do catálogo; `message` vai para a tela. */
export class CatalogRequestError extends Error {
  readonly code: CatalogErrorCode
  readonly fieldErrors: readonly CatalogFieldError[]
  /**
   * Código de erro do backend, quando ele informa um conhecido (TASK-046: `ROTATION_ZONE_IN_USE`,
   * `INVALID_ROTATION_ZONES`); `null` nos demais.
   */
  readonly apiCode: string | null

  constructor(
    code: CatalogErrorCode,
    message: string,
    fieldErrors: readonly CatalogFieldError[] = [],
    apiCode: string | null = null,
  ) {
    super(message)
    this.name = 'CatalogRequestError'
    this.code = code
    this.fieldErrors = fieldErrors
    this.apiCode = apiCode
  }
}
