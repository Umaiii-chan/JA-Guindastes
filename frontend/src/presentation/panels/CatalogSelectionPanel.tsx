import { RefreshCw, TriangleAlert } from 'lucide-react'
import { type ReactNode, useId } from 'react'

import type { CatalogList } from '../../application/catalog/CatalogBrowser'
import type { Crane, CraneConfiguration, Manufacturer } from '../../domain/catalog/catalog'
import { Badge, Button, Field, Notice, Panel, Select, Spinner } from '../ui'
import styles from './panels.module.css'

export interface CatalogSelectionPanelProps {
  readonly manufacturers: CatalogList<Manufacturer>
  readonly cranes: CatalogList<Crane>
  readonly configurations: CatalogList<CraneConfiguration>
  readonly selectedManufacturerId: string | null
  readonly selectedCraneId: string | null
  readonly selectedConfigurationId: string | null
  onSelectManufacturer(id: string | null): void
  onSelectCrane(id: string | null): void
  onSelectConfiguration(id: string | null): void
  /** Recarrega a lista de fabricantes (botão "Tentar de novo" quando ela falha). */
  onRetry?(): void
  /** Sem painel próprio: para ficar dentro de outro contêiner (ex.: passo do simulador). */
  readonly embedded?: boolean
  /** Ação quando não há fabricante cadastrado (ex.: link para a página Catálogo). */
  readonly emptyAction?: ReactNode
}

interface SelectOption {
  readonly id: string
  readonly label: string
}

const TITLE = 'Guindaste e configuração'

function formatNumber(value: number): string {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
}

/**
 * Seleção encadeada do catálogo (RF-010): fabricante → guindaste → configuração. A configuração
 * escolhida é a que vai para a avaliação no backend e define os limites dos sliders (TASK-033).
 */
export function CatalogSelectionPanel(props: CatalogSelectionPanelProps) {
  const {
    manufacturers,
    cranes,
    configurations,
    selectedManufacturerId,
    selectedCraneId,
    selectedConfigurationId,
    embedded = false,
  } = props
  const selected = configurations.items.find((item) => item.id === selectedConfigurationId) ?? null
  const noManufacturers = manufacturers.status === 'loaded' && manufacturers.items.length === 0

  const body = (
    <>
      <CatalogSelect
        label="Fabricante"
        list={manufacturers}
        options={manufacturers.items.map((item) => ({ id: item.id, label: item.name }))}
        selectedId={selectedManufacturerId}
        enabled
        emptyText="Nenhum fabricante cadastrado."
        onSelect={props.onSelectManufacturer}
        onRetry={props.onRetry}
      />
      {noManufacturers && props.emptyAction && (
        <div className={styles.inlineAction}>{props.emptyAction}</div>
      )}
      <CatalogSelect
        label="Guindaste"
        list={cranes}
        options={cranes.items.map((item) => ({ id: item.id, label: item.modelName }))}
        selectedId={selectedCraneId}
        enabled={selectedManufacturerId !== null}
        emptyText="Nenhum guindaste cadastrado neste fabricante."
        onSelect={props.onSelectCrane}
      />
      <CatalogSelect
        label="Configuração"
        list={configurations}
        options={configurations.items.map((item) => ({
          id: item.id,
          label: item.geometry ? item.name : `${item.name} (sem ficha técnica)`,
        }))}
        selectedId={selectedConfigurationId}
        enabled={selectedCraneId !== null}
        emptyText="Nenhuma configuração cadastrada neste guindaste."
        onSelect={props.onSelectConfiguration}
      />
      {selected && <ConfigurationSummary configuration={selected} />}
    </>
  )

  if (embedded) {
    return (
      <section className={styles.stack} aria-label={TITLE}>
        {body}
      </section>
    )
  }
  return <Panel title={TITLE}>{body}</Panel>
}

/** Ficha técnica da configuração escolhida, em chips; aviso quando não há ficha. */
function ConfigurationSummary({ configuration }: { readonly configuration: CraneConfiguration }) {
  const sheet = configuration.geometry
  if (!sheet) {
    return (
      <Notice
        tone="warning"
        compact
        title="Configuração sem ficha técnica"
        icon={<TriangleAlert size={14} />}
      >
        Sem a ficha técnica, a operação não pode ser avaliada.
      </Notice>
    )
  }
  const chips = [
    {
      label: 'Lança',
      value: `${formatNumber(sheet.boomLengthMinM)}–${formatNumber(sheet.boomLengthMaxM)} m`,
    },
    {
      label: 'θ',
      value: `${formatNumber(sheet.boomAngleMinDeg)}–${formatNumber(sheet.boomAngleMaxDeg)}°`,
    },
    {
      label: 'Cabo',
      value:
        sheet.cableLengthMaxM === null
          ? `≥ ${formatNumber(sheet.cableLengthMinM)} m`
          : `${formatNumber(sheet.cableLengthMinM)}–${formatNumber(sheet.cableLengthMaxM)} m`,
    },
    {
      label: 'Giro',
      value:
        sheet.turretRotationMinDeg === null || sheet.turretRotationMaxDeg === null
          ? 'contínuo'
          : `${formatNumber(sheet.turretRotationMinDeg)}…${formatNumber(sheet.turretRotationMaxDeg)}°`,
    },
    {
      label: 'a / h',
      value: `${formatNumber(sheet.boomPivotOffsetM)} / ${formatNumber(sheet.boomPivotHeightM)} m`,
    },
  ]
  return (
    <div className={styles.sheetSummary}>
      <div className={styles.sheetSummaryHeader}>
        <span>Ficha técnica</span>
        <Badge tone="ok">com ficha</Badge>
      </div>
      <dl className={styles.chips}>
        {chips.map((chip) => (
          <div key={chip.label} className={styles.chip}>
            <dt>{chip.label}</dt>
            <dd>{chip.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function CatalogSelect({
  label,
  list,
  options,
  selectedId,
  enabled,
  emptyText,
  onSelect,
  onRetry,
}: {
  readonly label: string
  readonly list: CatalogList<unknown>
  readonly options: readonly SelectOption[]
  readonly selectedId: string | null
  readonly enabled: boolean
  readonly emptyText: string
  onSelect(id: string | null): void
  onRetry?(): void
}) {
  const statusId = `${useId()}-status`
  const loading = list.status === 'loading'
  const failed = list.status === 'error'
  const empty = list.status === 'loaded' && options.length === 0

  return (
    <Field
      label={<span className={styles.labelWithIcon}>{label}</span>}
      labelAside={
        loading ? (
          <span className={styles.loadingHint}>
            <Spinner size={11} />
          </span>
        ) : undefined
      }
    >
      <Select
        value={selectedId ?? ''}
        disabled={!enabled || loading}
        aria-describedby={loading || failed || empty ? statusId : undefined}
        onChange={(event) => onSelect(event.currentTarget.value || null)}
      >
        <option value="">— escolha —</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </Select>
      {loading && (
        <span id={statusId} className={styles.fieldStatus}>
          Carregando…
        </span>
      )}
      {empty && (
        <span id={statusId} className={styles.fieldStatus}>
          {emptyText}
        </span>
      )}
      {failed && (
        <div id={statusId} className={styles.fieldError} role="alert">
          <span>{list.error}</span>
          {onRetry && (
            <Button size="sm" variant="ghost" icon={<RefreshCw size={13} />} onClick={onRetry}>
              Tentar de novo
            </Button>
          )}
        </div>
      )}
    </Field>
  )
}
