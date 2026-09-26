// Porta da importação e da ativação de tabelas de carga (TASK-034), sem saber que é `fetch`
// (implementação em `src/infrastructure/api/loadChartRestClient.ts`). Contrato do backend: TASK-031
// (`POST /api/v1/load-charts/import`, `POST /api/v1/load-charts/{id}/activate`).

/** Status da tabela de carga (doc-fonte § 13.2), como o backend envia. */
export type LoadChartStatus = 'DRAFT' | 'VALIDATED' | 'ACTIVE' | 'SUPERSEDED' | 'INVALID'

/** Ponto da tabela, em unidades internas (RN-006). */
export interface LoadChartPoint {
  readonly boomLengthM: number
  readonly workingRadiusM: number
  readonly maxCapacityKg: number
}

/** Tabela gravada no backend (`LoadChartResponse`). */
export interface StoredLoadChart {
  readonly chartId: string
  readonly version: string
  readonly configurationId: string
  readonly status: LoadChartStatus
  readonly points: readonly LoadChartPoint[]
  readonly sourceFileName: string
}

/** Uma inconsistência do relatório de importação (RNF-006; doc-fonte § 13.1). */
export interface LoadChartImportIssue {
  readonly code: string
  readonly message: string
  /** Linha física do arquivo, a partir de 1; `null` quando o problema é do arquivo todo. */
  readonly line: number | null
  /** Coluna como está no arquivo (ou a esperada, quando falta); `null` quando não é de coluna. */
  readonly column: string | null
}

export interface LoadChartImportRequest {
  readonly file: Blob
  readonly fileName: string
  readonly configurationId: string
  readonly chartId: string
  readonly version: string
}

/** Resultado de uma importação que o backend processou (201 ou 422 com relatório). */
export type LoadChartImportOutcome =
  | { readonly kind: 'IMPORTED'; readonly chart: StoredLoadChart }
  | { readonly kind: 'INVALID'; readonly issues: readonly LoadChartImportIssue[] }

/** Resultado da ativação (200): a tabela ativada e a que virou `SUPERSEDED`, se havia. */
export interface LoadChartActivation {
  readonly chart: StoredLoadChart
  readonly supersededChartId: string | null
}

/** Falha exibível (rede, 404, 409, 413, 415, resposta fora do contrato...). */
export interface LoadChartFailure {
  readonly code: string
  /** Status HTTP, quando houve resposta. */
  readonly httpStatus: number | null
  readonly message: string
}

/** As operações rejeitam com um erro que tem `code`, `httpStatus` e `message` (`LoadChartFailure`). */
export interface LoadChartGateway {
  importChart(request: LoadChartImportRequest): Promise<LoadChartImportOutcome>
  activateChart(chartId: string): Promise<LoadChartActivation>
}
