import { ArrowRight, Construction, Move3d, Package, Route } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'

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

const STEP_TEXT: Record<GuidedStepId, { title: string; description: string; icon: ReactNode }> = {
  crane: {
    title: 'Guindaste',
    description: 'Escolha fabricante, guindaste e configuração.',
    icon: <Construction size={13} />,
  },
  load: {
    title: 'Carga',
    description: 'Descreva a carga: peso e dimensões.',
    icon: <Package size={13} />,
  },
  position: {
    title: 'Posição',
    description: 'Gire a torre, incline e estenda a lança.',
    icon: <Move3d size={13} />,
  },
}

/**
 * Painel de passos do simulador guiado (ADR-017 § 2): 1 Guindaste → 2 Carga → 3 Posição, liberados em
 * sequência, com barra de progresso e botão para seguir ao próximo passo.
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
    icon: STEP_TEXT[id].icon,
  }))
  const next = nextStep(activeStep)
  const canContinue = statuses[activeStep] === 'complete' && next !== null

  return (
    <section className={styles.panel} aria-labelledby="guided-steps-title">
      <header className={styles.header}>
        <span className={styles.headerIcon} aria-hidden="true">
          <Route size={16} />
        </span>
        <div className={styles.headings}>
          <h2 id="guided-steps-title" className={styles.title}>
            Simulação guiada
          </h2>
          <p className={styles.progressText}>
            {done} de {GUIDED_STEPS.length} passos concluídos
          </p>
        </div>
      </header>
      <div
        className={styles.progress}
        role="progressbar"
        aria-label="Progresso da simulação"
        aria-valuemin={0}
        aria-valuemax={GUIDED_STEPS.length}
        aria-valuenow={done}
        style={{ '--progress': `${(done / GUIDED_STEPS.length) * 100}%` } as CSSProperties}
      />
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
