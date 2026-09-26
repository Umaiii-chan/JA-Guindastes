import { FileSpreadsheet, Settings2 } from 'lucide-react'
import { Link } from 'react-router'

import { SHEET_FIELD_KEYS, type SheetFieldKey } from '../../application/catalog/catalogForms'
import type { CraneConfiguration } from '../../domain/catalog/catalog'
import { ROUTES } from '../layout/navigation'
import { Page } from '../layout/Page'
import {
  CatalogRegistrationPanel,
  type CatalogRegistrationPanelProps,
} from '../panels/CatalogRegistrationPanel'
import {
  CatalogSelectionPanel,
  type CatalogSelectionPanelProps,
} from '../panels/CatalogSelectionPanel'
import { SHEET_FIELD_LABELS } from '../panels/technicalSheetLabels'
import { buttonClassName, EmptyState, Panel, Table } from '../ui'
import styles from './CatalogPage.module.css'

export interface CatalogPageProps {
  readonly selection: CatalogSelectionPanelProps
  readonly registration: CatalogRegistrationPanelProps
  /** Configuração escolhida na seleção (para mostrar a ficha técnica). */
  readonly selectedConfiguration: CraneConfiguration | null
}

interface SheetRow {
  readonly key: SheetFieldKey
  readonly value: number | null
}

/**
 * Catálogo (ADR-017 § 1), versão simples da TASK-039: navegação pela seleção encadeada, ficha técnica
 * da configuração escolhida e os cadastros. Listas completas, edição e perfis chegam na TASK-042.
 */
export function CatalogPage({ selection, registration, selectedConfiguration }: CatalogPageProps) {
  const sheet = selectedConfiguration?.geometry ?? null
  const rows: SheetRow[] = sheet ? SHEET_FIELD_KEYS.map((key) => ({ key, value: sheet[key] })) : []

  return (
    <Page intro="Navegue pelo catálogo, confira a ficha técnica de cada configuração e cadastre novos itens. A configuração escolhida aqui continua escolhida no simulador e nas tabelas.">
      <div className={styles.columns}>
        <div className={styles.column}>
          <CatalogSelectionPanel {...selection} />
          <Panel
            title="Ficha técnica"
            subtitle={
              selectedConfiguration
                ? `Configuração: ${selectedConfiguration.name}`
                : 'Da configuração escolhida'
            }
            icon={<Settings2 size={16} />}
            flush={sheet !== null}
          >
            {selectedConfiguration === null ? (
              <EmptyState
                compact
                icon={<Settings2 size={22} />}
                title="Nenhuma configuração escolhida"
                description="Escolha fabricante, guindaste e configuração acima para ver os limites e os parâmetros a e h."
              />
            ) : sheet === null ? (
              <EmptyState
                compact
                tone="warning"
                icon={<Settings2 size={22} />}
                title="Configuração sem ficha técnica"
                description="Sem a ficha, a avaliação responde “não avaliável”. Cadastre uma nova configuração com a ficha preenchida."
              />
            ) : (
              <Table
                caption={`Ficha técnica de ${selectedConfiguration.name}`}
                columns={[
                  {
                    key: 'field',
                    header: 'Campo',
                    render: (row: SheetRow) => SHEET_FIELD_LABELS[row.key],
                  },
                  {
                    key: 'value',
                    header: 'Valor',
                    numeric: true,
                    render: (row: SheetRow) =>
                      row.value === null ? '—' : row.value.toLocaleString('pt-BR'),
                  },
                ]}
                rows={rows}
                rowKey={(row) => row.key}
                dense
                className={styles.flushTable}
              />
            )}
          </Panel>
          {selectedConfiguration && (
            <Link
              to={ROUTES.tables}
              className={buttonClassName('secondary', 'md', styles.tablesLink)}
            >
              <FileSpreadsheet size={16} aria-hidden="true" />
              Importar a tabela de carga desta configuração
            </Link>
          )}
        </div>
        <div className={styles.column}>
          <CatalogRegistrationPanel {...registration} />
        </div>
      </div>
    </Page>
  )
}
