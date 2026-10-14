import { Sparkles } from 'lucide-react'
import { useId, useState } from 'react'

import { useAi } from '../../app/ai/aiContext'
import { useAiTask } from '../../app/ai/useAiTask'
import { MAX_AI_TEXT_CHARS, type AiScenarioDraft } from '../../application/ai/ports'
import { describeDraft } from '../../application/ai/scenarioDraft'
import { Button, cx, Dialog, Notice, Spinner } from '../ui'
import styles from './ai.module.css'
import { ModelNote } from './ModelNote'

const EXAMPLE =
  'Içar uma viga de 8 t e 6 m de comprimento de dentro do barracão até a carreta, a 20 m dali.'

export interface AssistantDialogProps {
  readonly open: boolean
  readonly onClose: () => void
  /** Aplica a proposta revisada no simulador (cenário, carga e entrega). */
  readonly onApply: (draft: AiScenarioDraft) => void
}

/**
 * Assistente de IA do simulador (TASK-076): a pessoa descreve a operação em texto, vê a prévia do
 * cenário que a IA montou e só então aplica. A IA não calcula nada: capacidade e segurança continuam
 * vindo do cálculo do simulador depois que o cenário é aplicado.
 */
export function AssistantDialog({ open, onClose, onApply }: AssistantDialogProps) {
  const { gateway } = useAi()
  const task = useAiTask<AiScenarioDraft>()
  const [text, setText] = useState('')
  const textId = useId()
  const draft = task.state.status === 'ready' ? task.state.result : null
  const loading = task.state.status === 'loading'
  const tooLong = text.length > MAX_AI_TEXT_CHARS
  const canGenerate = gateway !== null && text.trim() !== '' && !tooLong && !loading

  const generate = () => {
    if (gateway && canGenerate) task.run(() => gateway.scenarioFromText(text.trim()))
  }
  const close = () => {
    task.reset()
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Assistente de içamento"
      description="Descreva a operação e o assistente monta o cenário. Você revisa antes de aplicar."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancelar
          </Button>
          {draft ? (
            <>
              <Button onClick={generate} disabled={!canGenerate}>
                Gerar de novo
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  onApply(draft)
                  close()
                }}
              >
                Aplicar no simulador
              </Button>
            </>
          ) : (
            <Button variant="primary" onClick={generate} disabled={!canGenerate} loading={loading}>
              Gerar cenário
            </Button>
          )}
        </>
      }
    >
      <div className={styles.stack}>
        <div className={styles.field}>
          <label htmlFor={textId}>Descreva a operação</label>
          <textarea
            id={textId}
            className={styles.textarea}
            value={text}
            disabled={loading}
            placeholder="Ex.: içar uma viga de 8 t de dentro do barracão até a carreta a 20 m"
            data-autofocus
            onChange={(event) => setText(event.target.value)}
          />
          <span className={cx(styles.counter, tooLong && styles.counterOver)}>
            {text.length} / {MAX_AI_TEXT_CHARS}
          </span>
          {text === '' && (
            <button type="button" className={styles.example} onClick={() => setText(EXAMPLE)}>
              Usar um exemplo
            </button>
          )}
        </div>

        {loading && (
          <p className={styles.loading} role="status">
            <Spinner size={16} />O assistente está montando o cenário. Pode levar alguns segundos.
          </p>
        )}
        {task.state.status === 'error' && (
          <Notice tone="danger" role="alert" title="Não foi possível montar o cenário">
            {task.state.message}
          </Notice>
        )}

        {draft && (
          <section className={styles.preview} aria-label="Prévia do cenário">
            <p className={styles.subtitle}>Prévia do cenário</p>
            {draft.summary && <p>{draft.summary}</p>}
            <ul className={styles.previewList}>
              {describeDraft(draft).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            {draft.assumptions.length > 0 && (
              <>
                <p className={styles.subtitle}>Suposições do assistente</p>
                <ul className={styles.assumptions}>
                  {draft.assumptions.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </>
            )}
            <Notice tone="info" compact>
              Revise as medidas e as posições. O assistente não calcula capacidade nem segurança:
              isso continua com o cálculo do simulador depois de aplicar.
            </Notice>
            <ModelNote info={draft} />
          </section>
        )}
      </div>
    </Dialog>
  )
}

export interface AssistantButtonProps {
  readonly onApply: (draft: AiScenarioDraft) => void
  /** Desligado durante a reprodução de uma gravação. */
  readonly disabled?: boolean
}

/** Botão "Assistente" da barra do simulador; some quando a IA não está ativa (`/ai/status`). */
export function AssistantButton({ onApply, disabled = false }: AssistantButtonProps) {
  const { enabled } = useAi()
  const [open, setOpen] = useState(false)
  if (!enabled) return null
  return (
    <>
      <button
        type="button"
        className={styles.assistantToggle}
        disabled={disabled}
        title="Descreva a operação em texto e o assistente monta o cenário"
        onClick={() => setOpen(true)}
      >
        <Sparkles size={12} aria-hidden="true" />
        Assistente
      </button>
      <AssistantDialog open={open} onClose={() => setOpen(false)} onApply={onApply} />
    </>
  )
}
