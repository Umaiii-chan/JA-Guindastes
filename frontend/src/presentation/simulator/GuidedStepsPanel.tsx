import { ArrowRight } from 'lucide-react'
import type { ReactNode } from 'react'

import {
  completedStepCount,
  GUIDED_STEPS,
  type GuidedStepId,
  type GuidedStepStatuses,
  nextStep,
} from '../../application/simulator/guidedSteps'
import { Button, type StepItem, Stepper } from '../ui'
import styles from './GuidedStepsPanel.module.css'

export interface GuidedStepsPanelProps {
  readonly statuses: GuidedStepStatuses
  /** Passo aberto (já resolvido: sempre um passo liberado). */
  readonly activeStep: GuidedStepId
  readonly onSelectStep: (id: GuidedStepId) => void
  /** Conteúdo de cada passo. */
  readonly content: Readonly<Record<GuidedStepId, ReactNode>>
  /** Resumo do que foi escolhido em cada passo concluído (ex.: "Fabricante · Modelo · Config"). */
  readonly summaries?: Readonly<Partial<Record<GuidedStepId, ReactNode>>>
}

const STEP_TEXT: Record<GuidedStepId, { title: string; description: string }> = {
  crane: {
    title: 'Guindaste',
    description: 'Escolha fabricante, guindaste e configuração.',
  },
  load: {
    title: 'Carga',
    description: 'Descreva a carga: peso e dimensões.',
  },
  position: {
    title: 'Posição',
    description: 'Gire a torre, incline e estenda a lança.',
  },
}

/**
 * Coluna de procedimento do simulador guiado (ADR-017 § 2, com o visual do ADR-019): 01 Guindaste →
 * 02 Carga → 03 Posição, liberados em sequência, com a contagem e a régua de progresso no cabeçalho e
 * o botão para seguir ao próximo passo.
 */
export function GuidedStepsPanel({
  statuses,
  activeStep,
  onSelectStep,
  content,
  summaries = {},
}: GuidedStepsPanelProps) {
  const done = completedStepCount(statuses)
  const steps: StepItem[] = GUIDED_STEPS.map((id) => ({
    id,
    title: STEP_TEXT[id].title,
    description: STEP_TEXT[id].description,
    summary: summaries[id],
    status: statuses[id],
  }))
  const next = nextStep(activeStep)
  const canContinue = statuses[activeStep] === 'complete' && next !== null

  return (
    <section className={styles.panel} aria-labelledby="guided-steps-title">
      <header className={styles.header}>
        <div className={styles.headings}>
          <h2 id="guided-steps-title" className={styles.title}>
            Simulação guiada
          </h2>
          <p className={styles.progressText}>
            {done} de {GUIDED_STEPS.length} passos concluídos
          </p>
        </div>
        <div
          className={styles.progress}
          role="progressbar"
          aria-label="Progresso da simulação"
          aria-valuemin={0}
          aria-valuemax={GUIDED_STEPS.length}
          aria-valuenow={done}
        >
          {GUIDED_STEPS.map((id) => (
            <span
              key={id}
              className={styles.progressCell}
              data-status={statuses[id]}
              data-active={id === activeStep || undefined}
            />
          ))}
        </div>
      </header>
      <div className={styles.scroll}>
        <Stepper
          steps={steps}
          activeId={activeStep}
          onSelect={(id) => onSelectStep(id as GuidedStepId)}
          label="Passos da simulação"
        >
          {content[activeStep]}
          {canContinue && next && (
            <div className={styles.continue}>
              <Button
                variant="primary"
                iconAfter={<ArrowRight size={15} />}
                onClick={() => onSelectStep(next)}
              >
                Continuar para {STEP_TEXT[next].title}
              </Button>
            </div>
          )}
        </Stepper>
      </div>
    </section>
  )
}
