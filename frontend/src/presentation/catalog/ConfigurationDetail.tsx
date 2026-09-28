import { FileSpreadsheet, Grid3x3, Pencil, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'

import { formatZoneSector } from '../../application/catalog/rotationZones'
import { activeVersionsByZone, firstActiveVersion } from '../../application/loadChart/chartVersions'
import type { LoadChartSummary } from '../../application/loadChart/ports'
import type {
  Crane,
  CraneConfiguration,
  CraneTechnicalSheet,
  Manufacturer,
  RotationZone,
} from '../../domain/catalog/catalog'
import { ROUTES } from '../layout/navigation'
import { formatDegrees, formatMeters } from '../tables/format'
import { StoredChartMatrix } from '../tables/StoredChartMatrix'
import type { ChartVersionsState } from '../tables/useChartVersions'
import type { StoredChartState } from '../tables/useStoredChart'
import { Badge, Button, buttonClassName, cx, EmptyState, Notice, Panel, SkeletonText } from '../ui'
import styles from './catalog.module.css'
import { PivotFigure } from './PivotFigure'
import { RotationZoneDiagram } from './RotationZoneDiagram'

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

function activeOf(versions: ChartVersionsState, zones: readonly RotationZone[]) {
  return firstActiveVersion(
    versions.versions,
    versions.activeCharts,
    zones.map((zone) => zone.code),
    versions.activeChartId,
  )
}

/**
 * Ficha da configuração (CA-1 da TASK-042) como folha de especificações de fabricante (ADR-019):
 * tabela densa de rótulo e valor, a figura cotada de a e h, os limites (ADR-013 C-4), as zonas de
 * giro (TASK-046) e a tabela de carga ativa informada pelo backend (TASK-044). O carimbo no canto
 * leva a revisão em vigor: a versão da tabela ativa mostrada.
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
  const zones = configuration.rotationZones ?? []
  const active = activeOf(versions, zones)
  const [hoveredZone, setHoveredZone] = useState<string | null>(null)
  const highlightedZone = hoveredZone ?? active?.rotationZoneCode ?? null
  const hook = configuration.hookBlockWeightKg

  return (
    <Panel
      title={configuration.name}
      subtitle={[manufacturer?.name, crane?.modelName].filter(Boolean).join(' › ')}
      stamp={
        <span className={styles.stampLines}>
          <span>Ficha</span>
          <span>Rev. {active?.version ?? '—'}</span>
        </span>
      }
      className={styles.detail}
      actions={
        <>
          {sheet === null && <Badge tone="warning">Sem ficha</Badge>}
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
            <span className={styles.sectionNo} aria-hidden="true">
              A
            </span>
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
              <div className={styles.geometry}>
                <PivotFigure offsetM={sheet.boomPivotOffsetM} className={styles.pivotFigure} />
                <dl className={cx(styles.spec, styles.specLarge)}>
                  <div>
                    <dt>
                      <span className={styles.symbol}>a</span> Eixo de giro → pino da lança
                    </dt>
                    <dd>{formatMeters(sheet.boomPivotOffsetM)}</dd>
                  </div>
                  <div>
                    <dt>
                      <span className={styles.symbol}>h</span> Altura do pino da lança
                    </dt>
                    <dd>{formatMeters(sheet.boomPivotHeightM)}</dd>
                  </div>
                </dl>
              </div>
              <table className={styles.limits}>
                <caption className="visually-hidden">
                  Limites da configuração {configuration.name}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Limite</th>
                    <th scope="col" className={styles.num}>
                      Mín.
                    </th>
                    <th scope="col" className={styles.num}>
                      Máx.
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
          <dl className={styles.spec}>
            <div>
              <dt>Peso do gancho</dt>
              <dd className={cx(hook === null || hook === undefined ? styles.specNote : undefined)}>
                {hook === null || hook === undefined
                  ? 'não informado (conta como 0 kg)'
                  : `${hook.toLocaleString('pt-BR')} kg`}
              </dd>
            </div>
            <div>
              <dt>Identificação</dt>
              <dd>
                <code>{configuration.id}</code>
              </dd>
            </div>
          </dl>
        </section>

        <section
          className={cx(styles.detailSection, styles.chartSection)}
          aria-labelledby="tabela-ativa"
        >
          <h3 id="tabela-ativa" className={styles.sectionTitle}>
            <span className={styles.sectionNo} aria-hidden="true">
              B
            </span>
            {zones.length > 0 ? 'Zonas de giro e tabelas ativas' : 'Tabela de carga ativa'}
          </h3>
          {zones.length > 0 && (
            <ZonesWithActiveCharts
              zones={zones}
              versions={versions}
              highlighted={highlightedZone}
              onHover={setHoveredZone}
            />
          )}
          <ActiveChart versions={versions} activeChart={activeChart} zones={zones} />
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

/**
 * Zonas da configuração (TASK-046): o transferidor com os setores e a tabela com o setor e a tabela
 * ativa de cada uma (`active_charts` da listagem). A zona destacada é a da matriz abaixo, ou a da
 * linha sob o ponteiro.
 */
function ZonesWithActiveCharts({
  zones,
  versions,
  highlighted,
  onHover,
}: {
  readonly zones: readonly RotationZone[]
  readonly versions: ChartVersionsState
  readonly highlighted: string | null
  onHover(code: string | null): void
}) {
  const known = versions.status === 'loaded' || versions.versions.length > 0
  const byZone = activeVersionsByZone(versions.versions, versions.activeCharts)
  return (
    <div className={styles.zonesDetail}>
      <RotationZoneDiagram
        zones={zones}
        activeCode={highlighted}
        size={148}
        legend={false}
        className={styles.zoneFigure}
      />
      <table className={styles.zoneTable}>
        <caption className="visually-hidden">Zonas de giro e a tabela ativa de cada uma</caption>
        <thead>
          <tr>
            <th scope="col">Zona</th>
            <th scope="col">Setor de ψ</th>
            <th scope="col">Tabela ativa</th>
          </tr>
        </thead>
        <tbody onMouseLeave={() => onHover(null)}>
          {zones.map((zone) => (
            <ZoneRow
              key={zone.code}
              zone={zone}
              active={byZone.get(zone.code)}
              known={known}
              highlighted={zone.code === highlighted}
              onHover={onHover}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ZoneRow({
  zone,
  active,
  known,
  highlighted,
  onHover,
}: {
  readonly zone: RotationZone
  readonly active: LoadChartSummary | undefined
  readonly known: boolean
  readonly highlighted: boolean
  onHover(code: string | null): void
}) {
  return (
    <tr
      className={cx(highlighted && styles.zoneRowSelected)}
      onMouseEnter={() => onHover(zone.code)}
    >
      <th scope="row">
        {zone.name}
        <span className={styles.zoneCode}>{zone.code}</span>
      </th>
      <td className={styles.zoneSector}>{formatZoneSector(zone)}</td>
      <td>
        {active ? (
          <>
            <Badge tone="ok" variant="solid">
              {active.version}
            </Badge>{' '}
            <span className={cx(styles.activeFile, styles.zoneFile)} title={active.sourceFileName}>
              {active.sourceFileName}
            </span>
          </>
        ) : known ? (
          <Badge tone="warning">nenhuma</Badge>
        ) : (
          '—'
        )}
      </td>
    </tr>
  )
}

function ActiveChart({
  versions,
  activeChart,
  zones,
}: {
  readonly versions: ChartVersionsState
  readonly activeChart: StoredChartState
  readonly zones: readonly RotationZone[]
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
  const active = activeOf(versions, zones)
  const zoneName = active?.rotationZoneCode
    ? (zones.find((zone) => zone.code === active.rotationZoneCode)?.name ?? active.rotationZoneCode)
    : null
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
        <span className={styles.activeLabel}>Tab. em vigor</span>
        <span className={styles.activeVersion}>{active.version}</span>
        <Badge tone="ok" variant="solid">
          Ativa
        </Badge>
        {zoneName && (
          <Badge tone="info" variant="outline">
            zona {zoneName}
          </Badge>
        )}
        <span className={styles.activeFile}>{active.sourceFileName}</span>
      </p>
      <StoredChartMatrix
        state={activeChart}
        caption={`Tabela ativa ${active.version}${zoneName ? ` da zona ${zoneName}` : ''}`}
        compact
      />
    </div>
  )
}
