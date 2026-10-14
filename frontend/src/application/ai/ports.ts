// Porta do assistente de IA (TASK-076; ADR-039). Implementada por `src/infrastructure/api/aiRestClient.ts`.
//
// A IA só redige e organiza: capacidade, utilização e segurança vêm do cálculo do backend (RN-004,
// RN-008). O assistente monta propostas que a pessoa revisa, explica números já calculados e escreve
// textos de relatório. Falhas chegam como `AuthRequestError` (mesmo transporte dos demais clientes),
// com `message` em pt-BR pronta para a tela.

import type { ScenarioSpec } from '../../domain/environment/environment'
import type { EvaluationInput } from '../../domain/evaluation/evaluation'

/** `GET /api/v1/ai/status`. */
export interface AiStatus {
  readonly enabled: boolean
  /** Modelo padrão; `null` com a IA desligada. */
  readonly model: string | null
  /** Modelos reserva, na ordem em que são usados. */
  readonly fallbackModels: readonly string[]
  readonly usageLimitPerHour: number | null
}

/** Qual modelo respondeu de fato (pode ser um reserva quando o padrão está sobrecarregado). */
export interface AiModelInfo {
  readonly model: string
  readonly fallbackUsed: boolean
}

/** Carga proposta pela IA. */
export interface AiLoadDraft {
  readonly description: string
  readonly weightKg: number
  readonly lengthM: number
  readonly widthM: number
  readonly heightM: number
}

/** Proposta de cenário: a pessoa revisa e só então aplica. */
export interface AiScenarioDraft extends AiModelInfo {
  readonly summary: string
  readonly assumptions: readonly string[]
  readonly load: AiLoadDraft
  /** Cenário já validado pelo backend, com a posição da carga (`cargo`) e a entrega (`delivery`). */
  readonly scenario: ScenarioSpec
}

/** Texto em Markdown (explicação, relatório ou revisão). */
export interface AiText extends AiModelInfo {
  readonly markdown: string
}

export interface AiLiftReportRequest {
  /** Estado da operação: o backend o avalia de novo (os números do relatório são os dele). */
  readonly evaluation: EvaluationInput
  readonly load: {
    readonly description: string
    readonly lengthM: number
    readonly widthM: number
    readonly heightM: number
  }
  /** Nome do guindaste como aparece na tela. */
  readonly craneLabel?: string
  readonly scenario?: ScenarioSpec
  /** Observação da pessoa para constar no relatório. */
  readonly note?: string
}

export interface AiGateway {
  /** `GET /api/v1/ai/status`. */
  status(): Promise<AiStatus>
  /** `POST /api/v1/ai/scenario-from-text`. */
  scenarioFromText(text: string): Promise<AiScenarioDraft>
  /** `POST /api/v1/ai/explain-recommendation`: `recommendation` como o planejador a devolveu. */
  explainRecommendation(
    recommendation: Readonly<Record<string, unknown>>,
    context?: Readonly<Record<string, unknown>>,
  ): Promise<AiText>
  /** `POST /api/v1/ai/lift-report`. */
  liftReport(request: AiLiftReportRequest): Promise<AiText>
  /** `POST /api/v1/ai/review-recording`. */
  reviewRecording(recordingId: string): Promise<AiText>
}

/** Limite de caracteres da descrição da operação (o backend recusa acima disso). */
export const MAX_AI_TEXT_CHARS = 1500
