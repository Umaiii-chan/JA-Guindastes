// Confere o formulário de importação antes de enviar (TASK-034). Só a presença dos campos: o formato
// do arquivo, a existência da configuração e a unicidade da versão são decididos pelo backend
// (415, 404 e 409; TASK-031).

import type { LoadChartImportRequest } from './ports'

export interface LoadChartImportFormValues {
  readonly file: File | null
  readonly configurationId: string
  readonly chartId: string
  readonly version: string
}

export type LoadChartImportFormResult =
  | { readonly request: LoadChartImportRequest; readonly problems: readonly [] }
  | { readonly request: null; readonly problems: readonly string[] }

export function validateImportForm(values: LoadChartImportFormValues): LoadChartImportFormResult {
  const problems: string[] = []
  if (values.file === null) problems.push('Escolha o arquivo da tabela (CSV ou XLSX).')
  const configurationId = values.configurationId.trim()
  if (configurationId === '') problems.push('Informe a configuração (configuration_id).')
  const chartId = values.chartId.trim()
  if (chartId === '') problems.push('Informe o id da tabela (chart_id).')
  const version = values.version.trim()
  if (version === '') problems.push('Informe a versão da tabela.')

  if (values.file === null || problems.length > 0) return { request: null, problems }
  return {
    request: {
      file: values.file,
      fileName: values.file.name,
      configurationId,
      chartId,
      version,
    },
    problems: [],
  }
}
