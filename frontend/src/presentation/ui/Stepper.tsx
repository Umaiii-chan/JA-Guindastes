import { Check } from 'lucide-react'
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
  /** @deprecated Compatibilidade com o ADR-017: o procedimento mostra o número (01, 02, 03). */
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

/** Situação à vista, em caixa alta pequena; o resto só para leitores de tela. */
const STATUS_TEXT: Record<StepStatus, { visible: string; hidden?: string }> = {
  pending: { visible: 'bloqueado', hidden: ': conclua o passo anterior' },
  current: { visible: 'em andamento' },
  complete: { visible: 'concluído' },
}

/** Número do passo com dois dígitos, como num procedimento de manual (01, 02, 03). */
function stepNumber(index: number): string {
  return String(index + 1).padStart(2, '0')
}

/**
 * Procedimento numerado (ADR-019 § 2): 01, 02, 03 sobre um traço vertical que engrossa em tinta nos
 * passos concluídos e fica laranja no passo atual. O concluído recebe um check simples em tinta. Cada
 * cabeçalho é um botão: abre o passo se ele estiver liberado (`current` ou `complete`); um passo
 * `pending` fica desabilitado. O passo aberto recebe `aria-current="step"` e mostra o conteúdo logo
 * abaixo.
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
        const status = STATUS_TEXT[step.status]
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
                {stepNumber(index)}
              </span>
              <span className={styles.headings}>
                <span className={styles.kicker}>
                  <span className="visually-hidden">Passo {index + 1} — </span>
                  {status.visible}
                  {status.hidden && <span className="visually-hidden">{status.hidden}</span>}
                </span>
                <span className={styles.title}>{step.title}</span>
                {!isActive && step.status === 'complete' && step.summary && (
                  <span className={styles.summary}>{step.summary}</span>
                )}
                {!isActive && step.status !== 'complete' && step.description && (
                  <span className={styles.description}>{step.description}</span>
                )}
              </span>
              {step.status === 'complete' && (
                <span className={styles.state} aria-hidden="true">
                  <Check size={16} strokeWidth={2.25} />
                  {!isActive && <span className={styles.edit}>editar</span>}
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
