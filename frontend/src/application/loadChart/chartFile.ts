// Conferência local do arquivo da tabela antes de qualquer envio (TASK-042): extensão e tamanho. O
// conteúdo é validado pelo backend (`/validate` para CSV; a importação para CSV e XLSX).

export type LoadChartFileFormat = 'CSV' | 'XLSX'

/**
 * Limite padrão do upload no backend (`UploadLimits`, 1 MiB). É provisório (known-gaps P-008): se o
 * backend mudar, ele continua respondendo 413 e a tela mostra a mensagem dele.
 */
export const DEFAULT_MAX_FILE_BYTES = 1024 * 1024

export type LoadChartFileCheck =
  | { readonly ok: true; readonly format: LoadChartFileFormat }
  | { readonly ok: false; readonly problem: string }

export function checkLoadChartFile(
  file: { readonly name: string; readonly size: number },
  maxBytes: number = DEFAULT_MAX_FILE_BYTES,
): LoadChartFileCheck {
  const extension = /\.([^.]+)$/.exec(file.name)?.[1]?.toLowerCase()
  const format: LoadChartFileFormat | null =
    extension === 'csv' ? 'CSV' : extension === 'xlsx' ? 'XLSX' : null
  if (format === null) {
    return {
      ok: false,
      problem: `"${file.name}" não é CSV nem XLSX. Envie a tabela em um desses formatos.`,
    }
  }
  if (file.size === 0) return { ok: false, problem: `"${file.name}" está vazio.` }
  if (file.size > maxBytes) {
    return {
      ok: false,
      problem: `"${file.name}" tem ${formatBytes(file.size)}; o limite é ${formatBytes(maxBytes)}.`,
    }
  }
  return { ok: true, format }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024)
    return `${(bytes / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} KiB`
  return `${(bytes / (1024 * 1024)).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MiB`
}
