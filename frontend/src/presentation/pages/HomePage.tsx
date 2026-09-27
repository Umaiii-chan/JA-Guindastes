import {
  ArrowRight,
  ArrowUpRight,
  Axis3d,
  Building2,
  Construction,
  Database,
  FlaskConical,
  RefreshCw,
  Settings2,
  ShieldAlert,
  Table2,
  Unplug,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

import type { CatalogSummary } from '../../application/catalog/catalogSummary'
import { ROUTES } from '../layout/navigation'
import { Page } from '../layout/Page'
import { Badge, Button, buttonClassName, EmptyState, Notice, Panel, Skeleton } from '../ui'
import { HeroIllustration } from './HeroIllustration'
import styles from './HomePage.module.css'

export type CatalogSummaryState =
  | { readonly status: 'loading' }
  | { readonly status: 'loaded'; readonly summary: CatalogSummary }
  | { readonly status: 'error'; readonly message: string }

export interface HomePageProps {
  readonly catalog: CatalogSummaryState
  onRetryCatalog(): void
}

const SHORTCUTS: readonly {
  to: string
  title: string
  description: string
  icon: ReactNode
  cta: string
}[] = [
  {
    to: ROUTES.simulator,
    title: 'Simulador',
    description:
      'Escolha o guindaste, descreva a carga e posicione a lança. O backend devolve capacidade, utilização e raio.',
    icon: <Axis3d size={20} />,
    cta: 'Abrir o simulador',
  },
  {
    to: ROUTES.catalog,
    title: 'Catálogo',
    description:
      'Fabricantes, guindastes e configurações, com a ficha técnica que limita os controles.',
    icon: <Construction size={20} />,
    cta: 'Ver o catálogo',
  },
  {
    to: ROUTES.tables,
    title: 'Tabelas',
    description: 'Importe a tabela de carga (CSV ou XLSX) de uma configuração e ative-a.',
    icon: <Table2 size={20} />,
    cta: 'Importar tabela',
  },
]

/**
 * Início (ADR-017 § 1): boas-vindas, atalhos, resumo do catálogo e os avisos permanentes (dados
 * FICTÍCIOS, ADR-012; estratégia PROVISÓRIA, ADR-015).
 */
export function HomePage({ catalog, onRetryCatalog }: HomePageProps) {
  return (
    <Page width="wide">
      <section className={styles.hero} aria-labelledby="home-hero-title">
        <div className={styles.heroText}>
          <p className={styles.kicker}>
            <span className={styles.kickerDot} aria-hidden="true" />
            Simulador web 3D
          </p>
          <h2 id="home-hero-title" className={styles.heroTitle}>
            Simulador de Tabelas de Carga de Guindastes
          </h2>
          <p className={styles.heroLead}>
            Posicione o guindaste na cena 3D e veja, em tempo real, se a carga cabe na capacidade da
            tabela ativa. O resultado que vale é sempre o do backend.
          </p>
          <ol className={styles.flow} aria-label="Como funciona">
            <li>
              <span>1</span> Guindaste
            </li>
            <li aria-hidden="true" className={styles.flowArrow}>
              <ArrowRight size={14} />
            </li>
            <li>
              <span>2</span> Carga
            </li>
            <li aria-hidden="true" className={styles.flowArrow}>
              <ArrowRight size={14} />
            </li>
            <li>
              <span>3</span> Posição
            </li>
          </ol>
          <div className={styles.heroActions}>
            <Link to={ROUTES.simulator} className={buttonClassName('primary', 'lg')}>
              <Axis3d size={18} aria-hidden="true" />
              Abrir o simulador
            </Link>
            <Link to={ROUTES.catalog} className={buttonClassName('ghost', 'lg')}>
              Ver o catálogo
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
        <div className={styles.heroArt} aria-hidden="true">
          <HeroIllustration />
        </div>
      </section>

      <nav className={styles.shortcuts} aria-label="Atalhos">
        {SHORTCUTS.map((shortcut) => (
          <Link key={shortcut.to} to={shortcut.to} className={styles.shortcut}>
            <span className={styles.shortcutIcon} aria-hidden="true">
              {shortcut.icon}
            </span>
            <span className={styles.shortcutTitle}>{shortcut.title}</span>
            <span className={styles.shortcutText}>{shortcut.description}</span>
            <span className={styles.shortcutCta}>
              {shortcut.cta}
              <ArrowUpRight size={14} aria-hidden="true" />
            </span>
          </Link>
        ))}
      </nav>

      <div className={styles.columns}>
        <Panel
          title="Resumo do catálogo"
          subtitle="Dados lidos do backend agora"
          icon={<Database size={16} />}
          actions={
            catalog.status !== 'loading' ? (
              <Button
                size="sm"
                variant="ghost"
                icon={<RefreshCw size={13} />}
                onClick={onRetryCatalog}
              >
                Atualizar
              </Button>
            ) : undefined
          }
        >
          <CatalogSummaryView catalog={catalog} onRetry={onRetryCatalog} />
        </Panel>

        <Panel
          title="Avisos"
          subtitle="Valem para toda a aplicação"
          icon={<ShieldAlert size={16} />}
        >
          <Notice tone="warning" title="Dados FICTÍCIOS" icon={<FlaskConical size={16} />}>
            Guindastes, fichas e tabelas usados até agora são fictícios, até a empresa fornecer os
            dados oficiais (ADR-012). Não use os valores em operação real.
          </Notice>
          <Notice tone="warning" title="Estratégia PROVISÓRIA" icon={<ShieldAlert size={16} />}>
            A capacidade vem da consulta conservadora: um ponto da tabela, do lado seguro, sem
            interpolação (ADR-015). Não é o valor definitivo.
          </Notice>
          <Notice tone="info" title="O backend decide">
            A geometria desenhada no navegador é só pré-visualização. Capacidade e utilização são
            calculadas no backend (RN-008).
          </Notice>
        </Panel>
      </div>
    </Page>
  )
}

function CatalogSummaryView({
  catalog,
  onRetry,
}: {
  readonly catalog: CatalogSummaryState
  onRetry(): void
}) {
  if (catalog.status === 'loading') {
    return (
      <div className={styles.stats} aria-busy="true">
        <span className="visually-hidden" role="status">
          Carregando o resumo do catálogo…
        </span>
        {[0, 1, 2].map((index) => (
          <div key={index} className={styles.stat}>
            <Skeleton width={36} height={36} radius={10} />
            <Skeleton width="50%" height={26} />
            <Skeleton width="70%" height={10} />
          </div>
        ))}
      </div>
    )
  }
  if (catalog.status === 'error') {
    return (
      <EmptyState
        compact
        tone="danger"
        role="alert"
        icon={<Unplug size={22} />}
        title="Não foi possível ler o catálogo"
        description={
          <>
            {catalog.message} Confira se o backend está no ar (com o banco configurado) e tente de
            novo.
          </>
        }
        action={
          <Button size="sm" icon={<RefreshCw size={13} />} onClick={onRetry}>
            Tentar de novo
          </Button>
        }
      />
    )
  }
  const { summary } = catalog
  if (summary.manufacturers === 0) {
    return (
      <EmptyState
        compact
        icon={<Building2 size={22} />}
        title="O catálogo está vazio"
        description="Cadastre um fabricante, um guindaste e uma configuração com ficha técnica para simular."
        action={
          <Link to={ROUTES.catalog} className={buttonClassName('primary', 'sm')}>
            Cadastrar no catálogo
          </Link>
        }
      />
    )
  }
  const withSheetPercent =
    summary.configurations === 0
      ? 0
      : Math.round((summary.configurationsWithSheet / summary.configurations) * 100)
  return (
    <div className={styles.summary}>
      <div className={styles.stats} role="list" aria-label="Contagens do catálogo">
        <Stat icon={<Building2 size={18} />} label="Fabricantes" value={summary.manufacturers} />
        <Stat icon={<Construction size={18} />} label="Guindastes" value={summary.cranes} />
        <Stat icon={<Settings2 size={18} />} label="Configurações" value={summary.configurations} />
      </div>
      <div className={styles.sheetBar}>
        <div className={styles.sheetBarLabel}>
          <span>Configurações com ficha técnica</span>
          <span className="tabular">
            {summary.configurationsWithSheet} de {summary.configurations}
          </span>
        </div>
        <div
          className={styles.sheetBarTrack}
          role="meter"
          aria-label="Configurações com ficha técnica"
          aria-valuemin={0}
          aria-valuemax={summary.configurations}
          aria-valuenow={summary.configurationsWithSheet}
        >
          <span style={{ width: `${withSheetPercent}%` }} />
        </div>
        {summary.configurationsWithSheet < summary.configurations && (
          <p className={styles.sheetBarHint}>
            <Badge tone="warning">sem ficha</Badge>
            {summary.configurations - summary.configurationsWithSheet} configuração(ões) sem ficha
            técnica: a avaliação delas responde “não avaliável”.
          </p>
        )}
      </div>
    </div>
  )
}

function Stat({
  icon,
  label,
  value,
}: {
  readonly icon: ReactNode
  readonly label: string
  readonly value: number
}) {
  return (
    <div className={styles.stat} role="listitem">
      <span className={styles.statIcon} aria-hidden="true">
        {icon}
      </span>
      <span className={styles.statValue}>{value.toLocaleString('pt-BR')}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  )
}
