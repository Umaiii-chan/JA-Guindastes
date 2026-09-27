// Porta da importação e da ativação de tabelas de carga (TASK-034), sem saber que é `fetch`
// (implementação em `src/infrastructure/api/loadChartRestClient.ts`). Contrato do backend: TASK-019
// (`POST /api/v1/load-charts/validate`) e TASK-031 (`POST /api/v1/load-charts/import`,
// `GET /api/v1/load-charts/{id}`, `POST /api/v1/load-charts/{id}/activate`) e TASK-044
// (`GET /api/v1/configurations/{id}/load-charts`).

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

/** Versão de tabela na listagem de uma configuração: a `StoredLoadChart` sem os pontos. */
export interface LoadChartSummary {
  readonly chartId: string
  readonly version: string
  readonly configurationId: string
  readonly status: LoadChartStatus
  readonly pointCount: number
  readonly sourceFileName: string
}

/** Tabelas de uma configuração (`GET /configurations/{id}/load-charts`). */
export interface ConfigurationLoadCharts {
  /**
   * Ordem do backend: versão da maior para a menor, com os números comparados como números (`v10`,
   * `v9`, `v2.1`, `v2`, `v1`); empate por `chartId` decrescente. Não é a ordem de importação.
   */
  readonly items: readonly LoadChartSummary[]
  /** A tabela ativa da configuração, se houver (no máximo uma; ADR-009). */
  readonly activeChartId: string | null
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

/**
 * Resultado da validação prévia, sem gravar nada (`POST /validate`, 200). O backend só lê CSV nesta
 * rota (parser CSV na composição): XLSX é validado na importação.
 */
export type LoadChartValidation =
  | { readonly kind: 'VALID'; readonly points: readonly LoadChartPoint[] }
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
  /** Valida o arquivo sem gravar (o backend atual só lê CSV nesta rota). */
  validateChart(request: LoadChartImportRequest): Promise<LoadChartValidation>
  importChart(request: LoadChartImportRequest): Promise<LoadChartImportOutcome>
  /** Consulta uma tabela gravada pelo id (404 → `code` `LOAD_CHART_NOT_FOUND`). */
  getChart(chartId: string): Promise<StoredLoadChart>
  /** Lista as tabelas da configuração, sem os pontos (404 → `code` `CONFIGURATION_NOT_FOUND`). */
  listConfigurationCharts(configurationId: string): Promise<ConfigurationLoadCharts>
  activateChart(chartId: string): Promise<LoadChartActivation>
}
