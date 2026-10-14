import { FileText, Sparkles } from 'lucide-react'

import { useAi } from '../../app/ai/aiContext'
import { useAiTask } from '../../app/ai/useAiTask'
import type { AiLiftReportRequest, AiText } from '../../application/ai/ports'
import { Button } from '../ui'
import { AiTextDialog } from './AiTextDialog'

export interface ExplainRecommendationButtonProps {
  /** Recomendação como o planejador a devolveu (`POST /planning/recommend`, TASK-075). */
  readonly recommendation: Readonly<Record<string, unknown>>
  /** Contexto opcional (carga, retirada e entrega) para a explicação. */
  readonly context?: Readonly<Record<string, unknown>>
  readonly disabled?: boolean
}

/**
 * "Explicar" ao lado de uma recomendação do planejador (TASK-076): a IA explica, em linguagem
 * simples, os números que o planejador já calculou. Some com a IA desligada.
 */
export function ExplainRecommendationButton({
  recommendation,
  context,
  disabled = false,
}: ExplainRecommendationButtonProps) {
  const { gateway } = useAi()
  const task = useAiTask<AiText>()
  if (!gateway) return null
  const run = () => task.run(() => gateway.explainRecommendation(recommendation, context))
  return (
    <>
      <Button
        size="sm"
        icon={<Sparkles size={12} aria-hidden="true" />}
        disabled={disabled}
        onClick={run}
      >
        Explicar
      </Button>
      <AiTextDialog
        state={task.state}
        title="Explicação da recomendação"
        description="Texto escrito pela IA a partir dos números calculados pelo planejador."
        loadingLabel="O assistente está explicando a recomendação…"
        onClose={task.reset}
        onRetry={run}
      />
    </>
  )
}

export interface LiftReportButtonProps {
  /** Monta o pedido a partir do estado atual do simulador; `null` se faltar dado (sem carga, por exemplo). */
  readonly buildRequest: () => AiLiftReportRequest | null
}

/**
 * "Gerar relatório de içamento" (TASK-076): relatório em Markdown com a tabela de números do cálculo
 * do servidor e o texto da IA; imprimível e exportável em `.md`. Some com a IA desligada.
 */
export function LiftReportButton({ buildRequest }: LiftReportButtonProps) {
  const { gateway } = useAi()
  const task = useAiTask<AiText>()
  if (!gateway) return null
  const request = buildRequest()
  const run = () => {
    const current = buildRequest()
    if (current) task.run(() => gateway.liftReport(current))
  }
  return (
    <>
      <Button
        size="sm"
        icon={<FileText size={12} aria-hidden="true" />}
        disabled={request === null}
        title={
          request === null
            ? 'Escolha o guindaste e informe a carga para gerar o relatório'
            : 'Relatório do içamento para imprimir ou exportar'
        }
        onClick={run}
      >
        Gerar relatório de içamento
      </Button>
      <AiTextDialog
        state={task.state}
        title="Relatório de içamento"
        description="Os números vêm do cálculo do simulador; o texto é do assistente."
        loadingLabel="O assistente está montando o relatório…"
        onClose={task.reset}
        onRetry={run}
        exportable
      />
    </>
  )
}

export interface ReviewRecordingButtonProps {
  readonly recordingId: string
  readonly recordingName: string
}

/** "Revisar" numa gravação salva (TASK-076): a IA comenta os indicadores calculados da gravação. */
export function ReviewRecordingButton({ recordingId, recordingName }: ReviewRecordingButtonProps) {
  const { gateway } = useAi()
  const task = useAiTask<AiText>()
  if (!gateway) return null
  const run = () => task.run(() => gateway.reviewRecording(recordingId))
  return (
    <>
      <Button
        size="sm"
        icon={<Sparkles size={12} aria-hidden="true" />}
        aria-label={`Revisar ${recordingName}`}
        onClick={run}
      >
        Revisar
      </Button>
      <AiTextDialog
        state={task.state}
        title={`Revisão da gravação ${recordingName}`}
        description="Os indicadores são calculados dos quadros gravados; os comentários são do assistente."
        loadingLabel="O assistente está revisando a gravação…"
        onClose={task.reset}
        onRetry={run}
        exportable
      />
    </>
  )
}
