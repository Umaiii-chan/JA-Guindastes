import { CircleCheck, Link2, Unlink2 } from 'lucide-react'

import { type CargoGuidance } from '../../application/cargo/cargoGuidance'
import type { CargoStatus } from '../../domain/cargo/cargoOperation'
import { Button, cx } from '../ui'
import styles from './CargoOperationPanel.module.css'

export interface CargoOperationPanelProps {
  readonly status: CargoStatus
  readonly guidance: CargoGuidance
  /** Gravação em reprodução: os botões ficam travados. */
  readonly locked: boolean
  onEngage(): void
  onRelease(): void
}

/**
 * Faixa de coleta e entrega da carga (TASK-073; ADR-035), sob a barra da cena: os três passos como
 * dicas, uma mensagem do que falta e os botões Engatar e Soltar. Nada aqui trava o modo livre: os
 * passos só orientam.
 */
export function CargoOperationPanel({
  status,
  guidance,
  locked,
  onEngage,
  onRelease,
}: CargoOperationPanelProps) {
  const delivered = status.state?.result === 'delivered'
  return (
    <section className={styles.bar} aria-label="Coleta e entrega da carga">
      <ol className={styles.steps}>
        {guidance.steps.map((step, index) => (
          <li
            key={step.id}
            className={cx(
              styles.step,
              step.done && styles.done,
              guidance.currentStep === step.id && styles.current,
            )}
            aria-current={guidance.currentStep === step.id ? 'step' : undefined}
          >
            <span className={styles.index} aria-hidden="true">
              {step.done ? <CircleCheck size={13} /> : index + 1}
            </span>
            {step.label}
          </li>
        ))}
      </ol>
      <p
        className={cx(
          styles.message,
          guidance.tone === 'ok' && styles.ok,
          guidance.tone === 'warning' && styles.warning,
        )}
        role="status"
        data-delivered={delivered || undefined}
      >
        {guidance.message}
      </p>
      {status.active && (
        <div className={styles.actions}>
          <Button
            size="sm"
            variant="primary"
            icon={<Link2 size={14} />}
            disabled={locked || !status.canEngage}
            onClick={onEngage}
          >
            Engatar
          </Button>
          <Button
            size="sm"
            variant="secondary"
            icon={<Unlink2 size={14} />}
            disabled={locked || !status.canRelease}
            onClick={onRelease}
          >
            Soltar
          </Button>
        </div>
      )}
    </section>
  )
}
