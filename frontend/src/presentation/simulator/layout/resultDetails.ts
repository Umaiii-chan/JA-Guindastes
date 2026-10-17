// "Detalhes" do cartão de resultado (TASK-095; ADR-042): um só botão abre, no próprio cartão, a conta
// do peso, o limite, os alertas, a consulta e a geometria. O cartão guarda o estado; a ficha da
// avaliação (ou a do tandem) mostra o botão no lugar certo e esconde o que é detalhe.

import { createContext, useContext, useState } from 'react'

export interface ResultDetails {
  readonly open: boolean
  /** Id do bloco extra do cartão (geometria e relatório), para o `aria-controls` do botão. */
  readonly extraId: string | null
  toggle(): void
}

export const ResultDetailsContext = createContext<ResultDetails | null>(null)

/** Estado dos detalhes: o do cartão; fora dele, um estado local (fechado). */
export function useResultDetails(): ResultDetails {
  const context = useContext(ResultDetailsContext)
  const [open, setOpen] = useState(false)
  return context ?? { open, extraId: null, toggle: () => setOpen((value) => !value) }
}
