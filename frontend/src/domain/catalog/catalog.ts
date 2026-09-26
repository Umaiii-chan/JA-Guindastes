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

export interface CraneConfiguration {
  readonly id: string
  readonly craneId: string
  readonly name: string
  /** `null` quando a configuração foi cadastrada sem ficha técnica. */
  readonly geometry: CraneTechnicalSheet | null
}

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

  constructor(
    code: CatalogErrorCode,
    message: string,
    fieldErrors: readonly CatalogFieldError[] = [],
  ) {
    super(message)
    this.name = 'CatalogRequestError'
    this.code = code
    this.fieldErrors = fieldErrors
  }
}
