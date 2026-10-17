import { type ReactNode, useId, useMemo } from 'react'

import { useSectionOpen } from '../useSectionOpen'
import { type ResultDetails, ResultDetailsContext } from './resultDetails'
import styles from './ResultCard.module.css'

export interface ResultCardProps {
  /** Ficha da avaliação (ou a do tandem), com o botão "Detalhes". */
  readonly result: ReactNode
  /** Mais detalhes no fim do cartão (geometria de pré-visualização e o relatório). */
  readonly extra?: ReactNode
}

/**
 * Cartão de resultado no canto da cena (TASK-095; ADR-042). Guarda se "Detalhes" está aberto (e
 * lembra entre visitas) e o entrega à ficha pelo contexto; os detalhes ficam no HTML mesmo fechados.
 */
export function ResultCard({ result, extra }: ResultCardProps) {
  const [open, setOpen] = useSectionOpen('result-details', false)
  const extraId = `${useId()}-extra`
  const hasExtra = extra !== undefined && extra !== null
  const details = useMemo<ResultDetails>(
    () => ({ open, extraId: hasExtra ? extraId : null, toggle: () => setOpen(!open) }),
    [open, hasExtra, extraId, setOpen],
  )
  return (
    <aside className={styles.card} aria-label="Resultado da avaliação">
      <ResultDetailsContext.Provider value={details}>{result}</ResultDetailsContext.Provider>
      {hasExtra && (
        <div id={extraId} className={styles.extra} hidden={!open}>
          {extra}
        </div>
      )}
    </aside>
  )
}
