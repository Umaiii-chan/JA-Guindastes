import { Check, Lock } from 'lucide-react'
import { type ReactNode, useId } from 'react'

import { cx } from './cx'
import styles from './Stepper.module.css'

/** `pending`: ainda bloqueado; `current`: liberado e por fazer; `complete`: concluído. */
export type StepStatus = 'pending' | 'current' | 'complete'

export interface StepItem {
  readonly id: string
  readonly title: ReactNode
  /** Linha de apoio (o que fazer neste passo). */
  readonly description?: ReactNode
  /** Resumo do que foi escolhido, mostrado quando o passo está concluído e recolhido. */
  readonly summary?: ReactNode
  readonly status: StepStatus
  readonly icon?: ReactNode
}

export interface StepperProps {
  readonly steps: readonly StepItem[]
  /** Passo aberto (o conteúdo aparece embaixo dele). */
  readonly activeId: string
  readonly onSelect: (id: string) => void
  /** Conteúdo do passo aberto. */
  readonly children?: ReactNode
  readonly label?: string
  readonly className?: string
}

const STATUS_TEXT: Record<StepStatus, string> = {
  pending: 'bloqueado: conclua o passo anterior',
  current: 'em andamento',
  complete: 'concluído',
}

/**
 * Passos em sequência, na vertical. Cada cabeçalho é um botão: abre o passo se ele estiver liberado
 * (`current` ou `complete`); um passo `pending` fica desabilitado. O passo aberto recebe
 * `aria-current="step"` e mostra o conteúdo logo abaixo.
 */
export function Stepper({
  steps,
  activeId,
  onSelect,
  children,
  label = 'Passos',
  className,
}: StepperProps) {
  const baseId = useId()

  return (
    <ol className={cx(styles.stepper, className)} aria-label={label}>
      {steps.map((step, index) => {
        const isActive = step.id === activeId
        const locked = step.status === 'pending'
        const contentId = `${baseId}-${step.id}-content`
        return (
          <li
            key={step.id}
            className={cx(styles.step, styles[step.status], isActive && styles.active)}
            data-status={step.status}
          >
            <button
              type="button"
              className={styles.header}
              disabled={locked}
              aria-current={isActive ? 'step' : undefined}
              aria-expanded={isActive}
              aria-controls={isActive ? contentId : undefined}
              onClick={() => onSelect(step.id)}
            >
              <span className={styles.marker} aria-hidden="true">
                {step.status === 'complete' ? (
                  <Check size={14} strokeWidth={3} />
                ) : locked ? (
                  <Lock size={12} />
                ) : (
                  (step.icon ?? index + 1)
                )}
              </span>
              <span className={styles.headings}>
                <span className={styles.kicker}>
                  Passo {index + 1}
                  <span className="visually-hidden"> — {STATUS_TEXT[step.status]}</span>
                </span>
                <span className={styles.title}>{step.title}</span>
                {!isActive && step.status === 'complete' && step.summary && (
                  <span className={styles.summary}>{step.summary}</span>
                )}
                {!isActive && step.status !== 'complete' && step.description && (
                  <span className={styles.description}>{step.description}</span>
                )}
              </span>
              {!isActive && step.status === 'complete' && (
                <span className={styles.state} aria-hidden="true">
                  editar
                </span>
              )}
            </button>
            {isActive && (
              <div id={contentId} className={styles.content}>
                {step.description && <p className={styles.contentLead}>{step.description}</p>}
                {children}
              </div>
            )}
          </li>
        )
      })}
    </ol>
  )
}
