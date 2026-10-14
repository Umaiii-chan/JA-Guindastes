import { Download, Printer, RotateCw } from 'lucide-react'
import { useEffect } from 'react'
import { createPortal } from 'react-dom'

import type { AiTaskState } from '../../app/ai/useAiTask'
import { markdownFileName } from '../../application/ai/markdown'
import type { AiText } from '../../application/ai/ports'
import { Button, Dialog, Notice, Spinner } from '../ui'
import styles from './ai.module.css'
import { Markdown } from './Markdown'
import { ModelNote } from './ModelNote'
import './print.css'

export interface AiTextDialogProps {
  /** Estado da chamada; o diálogo fica aberto enquanto não estiver ocioso. */
  readonly state: AiTaskState<AiText>
  readonly title: string
  readonly description?: string
  /** Texto de espera, por exemplo "Montando o relatório…". */
  readonly loadingLabel?: string
  readonly onClose: () => void
  /** Tenta de novo depois de um erro, ou gera outra versão. */
  readonly onRetry: () => void
  /** Liga "Imprimir" e "Exportar .md" (relatórios). Sem isso, só leitura. */
  readonly exportable?: boolean
}

/** Baixa um texto como arquivo `.md` (sem passar pelo servidor). */
function downloadMarkdown(fileName: string, markdown: string): void {
  const url = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

/**
 * Mostra um texto do assistente de IA (explicação, relatório de içamento, revisão de gravação):
 * espera, erro com "Tentar de novo" ou o Markdown pronto, com o modelo que respondeu. Os textos
 * imprimíveis ganham uma cópia só para impressão (CSS `@media print`) e a exportação em `.md`.
 */
export function AiTextDialog({
  state,
  title,
  description,
  loadingLabel = 'O assistente está escrevendo. Pode levar alguns segundos.',
  onClose,
  onRetry,
  exportable = false,
}: AiTextDialogProps) {
  const result = state.status === 'ready' ? state.result : null
  const printable = exportable && result !== null

  // Enquanto o texto imprimível está aberto, o `body` leva a classe que esconde o resto na impressão.
  useEffect(() => {
    if (!printable) return
    document.body.classList.add('ai-printing')
    return () => document.body.classList.remove('ai-printing')
  }, [printable])

  return (
    <>
      <Dialog
        open={state.status !== 'idle'}
        onClose={onClose}
        title={title}
        description={description}
        size="lg"
        footer={
          <>
            {printable && (
              <>
                <Button
                  icon={<Printer size={14} aria-hidden="true" />}
                  onClick={() => window.print()}
                >
                  Imprimir
                </Button>
                <Button
                  icon={<Download size={14} aria-hidden="true" />}
                  onClick={() => downloadMarkdown(markdownFileName(title), result.markdown)}
                >
                  Exportar .md
                </Button>
              </>
            )}
            {(state.status === 'error' || state.status === 'ready') && (
              <Button
                variant="ghost"
                icon={<RotateCw size={14} aria-hidden="true" />}
                onClick={onRetry}
              >
                {state.status === 'error' ? 'Tentar de novo' : 'Gerar de novo'}
              </Button>
            )}
            <Button variant="primary" onClick={onClose}>
              Fechar
            </Button>
          </>
        }
      >
        {state.status === 'loading' && (
          <p className={styles.loading} role="status">
            <Spinner size={16} />
            {loadingLabel}
          </p>
        )}
        {state.status === 'error' && (
          <Notice tone="danger" role="alert" title="Não foi possível concluir">
            {state.message}
          </Notice>
        )}
        {result && (
          <>
            <ModelNote info={result} />
            <Markdown source={result.markdown} />
          </>
        )}
      </Dialog>
      {printable &&
        createPortal(
          <div className="ai-print-root" aria-hidden="true">
            <Markdown source={result.markdown} />
          </div>,
          document.body,
        )}
    </>
  )
}
