import { useMemo, useState } from 'react'

import {
  EMPTY_LOAD_FORM,
  type LoadFormValues,
  loadWeightTextForEvaluation,
} from '../../application/load/loadForm'
import type { LoadChartGateway } from '../../application/loadChart/ports'
import { createLoadChartRestClient } from '../../infrastructure/api/loadChartRestClient'
import { LoadChartImportPanel } from './LoadChartImportPanel'
import { LoadPanel } from './LoadPanel'

export interface LoadChartAndLoadPanelsProps {
  /** Configuração selecionada; ausente = o painel de importação mostra um campo próprio. */
  readonly configurationId?: string
  /**
   * Recebe o texto do peso para a avaliação a cada mudança da carga: o peso quando a carga toda é
   * válida, vazio caso contrário (`loadWeightTextForEvaluation`). No App, `setLoadWeightText`.
   */
  onLoadWeightTextChange(weightText: string): void
  /** Porta da importação/ativação (testes); padrão: o cliente REST na mesma origem. */
  readonly gateway?: LoadChartGateway
}

/** Painéis da TASK-034 juntos, para o App montar com um único bloco. */
export function LoadChartAndLoadPanels({
  configurationId,
  onLoadWeightTextChange,
  gateway,
}: LoadChartAndLoadPanelsProps) {
  const effectiveGateway = useMemo(() => gateway ?? createLoadChartRestClient(), [gateway])
  const [load, setLoad] = useState<LoadFormValues>(EMPTY_LOAD_FORM)

  const handleLoadChange = (next: LoadFormValues) => {
    setLoad(next)
    onLoadWeightTextChange(loadWeightTextForEvaluation(next))
  }

  return (
    <>
      <LoadPanel values={load} onChange={handleLoadChange} />
      <LoadChartImportPanel gateway={effectiveGateway} configurationId={configurationId} />
    </>
  )
}
