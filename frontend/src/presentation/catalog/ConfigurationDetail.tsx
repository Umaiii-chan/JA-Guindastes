import { FileSpreadsheet, Grid3x3, Pencil, Settings2, TriangleAlert } from 'lucide-react'
import { Link } from 'react-router'

import { activeVersion } from '../../application/loadChart/chartVersions'
import type {
  Crane,
  CraneConfiguration,
  CraneTechnicalSheet,
  Manufacturer,
} from '../../domain/catalog/catalog'
import { ROUTES } from '../layout/navigation'
import { formatDegrees, formatMeters } from '../tables/format'
import { StoredChartMatrix } from '../tables/StoredChartMatrix'
import type { ChartVersionsState } from '../tables/useChartVersions'
import type { StoredChartState } from '../tables/useStoredChart'
import { Badge, Button, buttonClassName, EmptyState, Notice, Panel, SkeletonText } from '../ui'
import styles from './catalog.module.css'

export interface ConfigurationDetailProps {
  readonly manufacturer: Manufacturer | null
  readonly crane: Crane | null
  readonly configuration: CraneConfiguration
  /** Tabelas da configuração (`GET /configurations/{id}/load-charts`; TASK-044). */
  readonly versions: ChartVersionsState
  /** A tabela ativa com os pontos (`GET /load-charts/{id}`), para a matriz. */
  readonly activeChart: StoredChartState
  readonly canEdit: boolean
  onEdit(): void
}

interface LimitRow {
  readonly symbol: string
  readonly label: string
  readonly min: string
  readonly max: string
}

function limitRows(sheet: CraneTechnicalSheet): readonly LimitRow[] {
  return [
    {
      symbol: 'L',
      label: 'Comprimento da lança',
      min: formatMeters(sheet.boomLengthMinM),
      max: formatMeters(sheet.boomLengthMaxM),
    },
    {
      symbol: 'θ',
      label: 'Inclinação da lança',
      min: formatDegrees(sheet.boomAngleMinDeg),
      max: formatDegrees(sheet.boomAngleMaxDeg),
    },
    {
      symbol: 'c',
      label: 'Comprimento do cabo',
      min: formatMeters(sheet.cableLengthMinM),
      max: sheet.cableLengthMaxM === null ? 'sem máximo' : formatMeters(sheet.cableLengthMaxM),
    },
    {
      symbol: 'ψ',
      label: 'Giro da torre',
      min:
        sheet.turretRotationMinDeg === null
          ? 'contínuo'
          : formatDegrees(sheet.turretRotationMinDeg),
      max:
        sheet.turretRotationMaxDeg === null
          ? 'contínuo'
          : formatDegrees(sheet.turretRotationMaxDeg),
    },
  ]
}

/**
 * Detalhe da configuração (CA-1 da TASK-042): a ficha técnica (a, h e os limites; ADR-013 C-4) e a
 * tabela de carga ativa, informada pelo backend (TASK-044).
 */
export function ConfigurationDetail({
  manufacturer,
  crane,
  configuration,
  versions,
  activeChart,
  canEdit,
  onEdit,
}: ConfigurationDetailProps) {
  const sheet = configuration.geometry
  return (
    <Panel
      title={configuration.name}
      subtitle={[manufacturer?.name, crane?.modelName].filter(Boolean).join(' › ')}
      icon={<Settings2 size={16} />}
      className={styles.detail}
      actions={
        <>
          <Badge tone={sheet ? 'ok' : 'warning'}>{sheet ? 'Com ficha' : 'Sem ficha'}</Badge>
          {canEdit && (
            <Button size="sm" variant="ghost" icon={<Pencil size={14} />} onClick={onEdit}>
              Editar
            </Button>
          )}
        </>
      }
    >
      <div className={styles.detailGrid}>
        <section className={styles.detailSection} aria-labelledby="ficha-tecnica">
          <h3 id="ficha-tecnica" className={styles.sectionTitle}>
            Ficha técnica
          </h3>
          {sheet === null ? (
            <EmptyState
              compact
              tone="warning"
              icon={<TriangleAlert size={22} />}
              title="Configuração sem ficha técnica"
              description="Sem a ficha, a avaliação responde “não avaliável”. Edite a configuração para preencher a ficha."
            />
          ) : (
            <>
              <dl className={styles.pivot}>
                <div className={styles.pivotTile}>
                  <dt>
                    <span className={styles.symbol}>a</span> eixo de giro → pino da lança
                  </dt>
                  <dd>{formatMeters(sheet.boomPivotOffsetM)}</dd>
                </div>
                <div className={styles.pivotTile}>
                  <dt>
                    <span className={styles.symbol}>h</span> altura do pino da lança
                  </dt>
                  <dd>{formatMeters(sheet.boomPivotHeightM)}</dd>
                </div>
              </dl>
              <table className={styles.limits}>
                <caption className="visually-hidden">
                  Limites da configuração {configuration.name}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Limite</th>
                    <th scope="col" className={styles.num}>
                      Mínimo
                    </th>
                    <th scope="col" className={styles.num}>
                      Máximo
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {limitRows(sheet).map((row) => (
                    <tr key={row.symbol}>
                      <th scope="row">
                        <span className={styles.symbol}>{row.symbol}</span> {row.label}
                      </th>
                      <td className={styles.num}>{row.min}</td>
                      <td className={styles.num}>{row.max}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          <p className={styles.idLine}>
            id <code>{configuration.id}</code>
          </p>
        </section>

        <section className={styles.detailSection} aria-labelledby="tabela-ativa">
          <h3 id="tabela-ativa" className={styles.sectionTitle}>
            Tabela de carga ativa
          </h3>
          <ActiveChart versions={versions} activeChart={activeChart} />
          <Link
            to={ROUTES.tables}
            className={buttonClassName('secondary', 'sm', styles.tablesLink)}
          >
            <FileSpreadsheet size={15} aria-hidden="true" />
            Importar e gerenciar versões
          </Link>
        </section>
      </div>
    </Panel>
  )
}

function ActiveChart({
  versions,
  activeChart,
}: {
  readonly versions: ChartVersionsState
  readonly activeChart: StoredChartState
}) {
  if (versions.status === 'loading' && versions.versions.length === 0) {
    return (
      <div aria-busy="true">
        <span className="visually-hidden">Carregando a tabela ativa…</span>
        <SkeletonText lines={4} />
      </div>
    )
  }
  if (versions.status === 'error') {
    return (
      <Notice tone="danger" role="alert" compact title="Não foi possível ler as tabelas">
        {versions.error}
      </Notice>
    )
  }
  const active = activeVersion(versions.versions, versions.activeChartId)
  if (!active) {
    return (
      <EmptyState
        compact
        tone="neutral"
        icon={<Grid3x3 size={22} />}
        title="Nenhuma tabela ativa"
        description={
          versions.versions.length === 0
            ? 'Esta configuração ainda não tem tabela de carga. Importe e ative uma na página Tabelas.'
            : `Há ${versions.versions.length === 1 ? '1 versão importada' : `${versions.versions.length} versões importadas`}, nenhuma ativa. Ative uma na página Tabelas para valer na avaliação.`
        }
      />
    )
  }
  return (
    <div className={styles.activeChart}>
      <p className={styles.activeChartHead}>
        <span className={styles.activeVersion}>{active.version}</span>
        <Badge tone="ok" variant="solid">
          Ativa
        </Badge>
        <span className={styles.activeFile}>{active.sourceFileName}</span>
      </p>
      <StoredChartMatrix state={activeChart} caption={`Tabela ativa ${active.version}`} compact />
    </div>
  )
}
