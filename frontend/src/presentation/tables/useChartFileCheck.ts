// Validação prévia do arquivo solto na área de importação (TASK-042): primeiro a conferência local
// (extensão e tamanho) e, para CSV, a validação do backend sem gravar (`POST /validate`). XLSX só é
// lido pelo backend na importação: fica "não verificado" até lá.

import { useCallback, useRef, useState } from 'react'

import { checkLoadChartFile, type LoadChartFileFormat } from '../../application/loadChart/chartFile'
import { toLoadChartFailure } from '../../application/loadChart/chartVersions'
import type {
  LoadChartGateway,
  LoadChartImportIssue,
  LoadChartPoint,
} from '../../application/loadChart/ports'

export type ChartFileState =
  | { readonly status: 'idle' }
  /** Recusado antes de enviar (extensão, vazio, tamanho). */
  | { readonly status: 'rejected'; readonly fileName: string; readonly problem: string }
  | { readonly status: 'validating'; readonly file: File; readonly format: LoadChartFileFormat }
  | {
      readonly status: 'valid'
      readonly file: File
      readonly format: LoadChartFileFormat
      readonly points: readonly LoadChartPoint[]
    }
  | {
      readonly status: 'invalid'
      readonly file: File
      readonly format: LoadChartFileFormat
      readonly issues: readonly LoadChartImportIssue[]
    }
  /** XLSX: passou na conferência local; o conteúdo é validado na importação. */
  | { readonly status: 'unverified'; readonly file: File; readonly format: LoadChartFileFormat }
  /** A validação não respondeu (rede, 413...). A importação ainda valida tudo de novo. */
  | {
      readonly status: 'error'
      readonly file: File
      readonly format: LoadChartFileFormat
      readonly message: string
    }

export interface ChartFileContext {
  readonly configurationId: string
  readonly chartId: string
  readonly version: string
}

export interface ChartFileCheckApi {
  readonly state: ChartFileState
  check(file: File, context: ChartFileContext): Promise<void>
  /** A importação devolveu o relatório (422): mostra-o no lugar da validação prévia. */
  showIssues(issues: readonly LoadChartImportIssue[]): void
  reset(): void
}

export function useChartFileCheck(
  gateway: Pick<LoadChartGateway, 'validateChart'>,
): ChartFileCheckApi {
  const [state, setState] = useState<ChartFileState>({ status: 'idle' })
  const requestId = useRef(0)

  const check = useCallback(
    async (file: File, context: ChartFileContext) => {
      requestId.current += 1
      const current = requestId.current
      const local = checkLoadChartFile(file)
      if (!local.ok) {
        setState({ status: 'rejected', fileName: file.name, problem: local.problem })
        return
      }
      if (local.format === 'XLSX') {
        setState({ status: 'unverified', file, format: local.format })
        return
      }
      setState({ status: 'validating', file, format: local.format })
      try {
        const result = await gateway.validateChart({
          file,
          fileName: file.name,
          configurationId: context.configurationId,
          // A validação não grava: sem id ou versão digitados, vai um marcador.
          chartId: context.chartId.trim() || 'previa',
          version: context.version.trim() || 'previa',
        })
        if (current !== requestId.current) return
        setState(
          result.kind === 'VALID'
            ? { status: 'valid', file, format: local.format, points: result.points }
            : { status: 'invalid', file, format: local.format, issues: result.issues },
        )
      } catch (error) {
        if (current !== requestId.current) return
        setState({
          status: 'error',
          file,
          format: local.format,
          message: toLoadChartFailure(error).message,
        })
      }
    },
    [gateway],
  )

  const showIssues = useCallback((issues: readonly LoadChartImportIssue[]) => {
    setState((current) =>
      'file' in current
        ? { status: 'invalid', file: current.file, format: current.format, issues }
        : current,
    )
  }, [])

  const reset = useCallback(() => {
    requestId.current += 1
    setState({ status: 'idle' })
  }, [])

  return { state, check, showIssues, reset }
}
