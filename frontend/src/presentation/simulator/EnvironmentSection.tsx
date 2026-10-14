import type { ReactNode } from 'react'

import { CollapsibleSection } from './CollapsibleSection'

export interface EnvironmentSectionProps {
  /** Resumo do cenário em edição, mostrado no cabeçalho (ex.: "2 feições · 1 obstáculo"). */
  readonly summary: ReactNode
  /** Avisado quando a seção abre (a tela carrega a lista de cenários salvos). */
  onOpen?(): void
  readonly children: ReactNode
}

/**
 * Seção "Ambiente" da coluna de procedimento (TASK-052; TASK-066): recolhível como as outras, com o
 * estado lembrado. Aqui ficam a lista de feições e obstáculos, o ajuste fino e os cenários salvos; o
 * desenho do ambiente é feito direto na cena 3D.
 */
export function EnvironmentSection({ summary, onOpen, children }: EnvironmentSectionProps) {
  return (
    <CollapsibleSection id="environment" title="Ambiente" summary={summary} onOpen={onOpen}>
      {children}
    </CollapsibleSection>
  )
}
