import { History } from 'lucide-react'

import type { LoadChartGateway } from '../../application/loadChart/ports'
import { Page } from '../layout/Page'
import {
  CatalogSelectionPanel,
  type CatalogSelectionPanelProps,
} from '../panels/CatalogSelectionPanel'
import { LoadChartImportPanel } from '../panels/LoadChartImportPanel'
import { EmptyState, Panel } from '../ui'
import styles from './CatalogPage.module.css'

export interface TablesPageProps {
  readonly selection: CatalogSelectionPanelProps
  readonly gateway: LoadChartGateway
  /** Configuração escolhida na seleção; sem ela, o painel de importação pede o id. */
  readonly configurationId: string | undefined
}

/**
 * Tabelas de carga (ADR-017 § 1), versão simples da TASK-039: escolha da configuração e importação
 * com ativação. Versões e ativação por lista chegam na TASK-042.
 */
export function TablesPage({ selection, gateway, configurationId }: TablesPageProps) {
  return (
    <Page intro="A tabela importada entra como rascunho (DRAFT) e só vale para a avaliação depois de ativada. Ativar uma tabela substitui a ativa da mesma configuração.">
      <div className={styles.columns}>
        <div className={styles.column}>
          <CatalogSelectionPanel {...selection} />
          <Panel
            title="Versões"
            subtitle="Histórico das tabelas da configuração"
            icon={<History size={16} />}
          >
            <EmptyState
              compact
              tone="neutral"
              icon={<History size={22} />}
              title="Lista de versões em construção"
              description="Por enquanto, importe e ative pela área ao lado; o resultado mostra a tabela ativa e a substituída."
            />
          </Panel>
        </div>
        <div className={styles.column}>
          <LoadChartImportPanel
            key={configurationId ?? 'sem-configuracao'}
            gateway={gateway}
            configurationId={configurationId}
          />
        </div>
      </div>
    </Page>
  )
}
