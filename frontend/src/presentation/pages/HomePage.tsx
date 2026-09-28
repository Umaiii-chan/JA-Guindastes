import { ArrowRight, Building2, RefreshCw, Unplug } from 'lucide-react'
import { Link } from 'react-router'

import type { CatalogSummary } from '../../application/catalog/catalogSummary'
import { ROUTES } from '../layout/navigation'
import { Page } from '../layout/Page'
import { Badge, Button, buttonClassName, EmptyState, Skeleton } from '../ui'
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

/** Entradas do índice: cada página do manual, com o número da folha. */
const INDEX: readonly {
  to: string
  sheet: string
  title: string
  description: string
}[] = [
  {
    to: ROUTES.simulator,
    sheet: '02',
    title: 'Simulador',
    description:
      'Escolha o guindaste, descreva a carga e posicione a lança. O backend devolve capacidade, utilização e raio.',
  },
  {
    to: ROUTES.catalog,
    sheet: '03',
    title: 'Catálogo',
    description:
      'Fabricantes, guindastes e configurações, com a ficha técnica que limita os controles.',
  },
  {
    to: ROUTES.tables,
    sheet: '04',
    title: 'Tabelas',
    description: 'Importe a tabela de carga (CSV ou XLSX) de uma configuração e ative-a.',
  },
]

/**
 * Início (ADR-017 § 1, com o visual do ADR-019): folha assimétrica. À esquerda, a coluna larga com a
 * abertura, a figura com as cotas e o índice do manual; à direita, a coluna estreita e densa com o
 * resumo do catálogo em tabela e as notas de rodapé dos avisos permanentes (dados FICTÍCIOS, ADR-012;
 * estratégia PROVISÓRIA, ADR-015; o backend decide, RN-008).
 */
export function HomePage({ catalog, onRetryCatalog }: HomePageProps) {
  return (
    <Page width="wide">
      <div className={styles.sheet}>
        <section className={styles.main} aria-labelledby="home-hero-title">
          <header className={styles.opening}>
            <div className={styles.openingTitle}>
              <p className={styles.kicker}>
                Manual de operação <span aria-hidden="true">·</span> Seção 0
              </p>
              <h2 id="home-hero-title" className={styles.title}>
                Simulador de Tabelas de Carga de Guindastes
              </h2>
            </div>
            <div className={styles.openingText}>
              <p className={styles.lead}>
                Posicione o guindaste na cena 3D e veja, em tempo real, se a carga cabe na
                capacidade da tabela ativa. O resultado que vale é sempre o do backend.<sup>3</sup>
              </p>
              <div className={styles.actions}>
                <Link to={ROUTES.simulator} className={buttonClassName('primary', 'md')}>
                  Abrir o simulador
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
                <Link to={ROUTES.catalog} className={buttonClassName('secondary', 'md')}>
                  Ver o catálogo
                </Link>
              </div>
            </div>
          </header>

          <figure className={styles.figure}>
            <HeroIllustration />
            <span className={styles.stamp} aria-hidden="true">
              Dados fictícios
            </span>
            <figcaption className={styles.figcaption}>
              <span className={styles.figNumber}>Fig. 1</span>
              <span>
                O que o simulador mede: raio de trabalho <b>R</b>, do eixo de giro até a vertical do
                gancho; inclinação <b>θ</b> e comprimento <b>L</b> da lança.
              </span>
            </figcaption>
          </figure>

          <div className={styles.index}>
            <div className={styles.indexHeader}>
              <h3 className={styles.sectionTitle}>Índice</h3>
              <ol className={styles.flow} aria-label="Como funciona">
                <li>
                  <span>01</span> Guindaste
                </li>
                <li>
                  <span>02</span> Carga
                </li>
                <li>
                  <span>03</span> Posição
                </li>
              </ol>
            </div>
            <nav aria-label="Atalhos">
              <ol className={styles.indexList}>
                {INDEX.map((entry, position) => (
                  <li key={entry.to}>
                    <Link to={entry.to} className={styles.indexLink}>
                      <span className={styles.indexNumber} aria-hidden="true">
                        {position + 1}.0
                      </span>
                      <span className={styles.indexText}>
                        <span className={styles.indexTitle}>{entry.title}</span>
                        <span className={styles.indexDescription}>{entry.description}</span>
                      </span>
                      <span className={styles.indexSheet}>
                        <span className="visually-hidden">folha </span>
                        <span aria-hidden="true">Fl. </span>
                        {entry.sheet}
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            </nav>
          </div>
        </section>

        <aside className={styles.side} aria-label="Resumo e notas">
          <section className={styles.block} aria-labelledby="home-summary-title">
            <div className={styles.blockHeader}>
              <h2 id="home-summary-title" className={styles.sectionTitle}>
                Resumo do catálogo
              </h2>
              {catalog.status !== 'loading' && (
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<RefreshCw size={12} />}
                  onClick={onRetryCatalog}
                >
                  Atualizar
                </Button>
              )}
            </div>
            <p className={styles.blockNote}>Lido do backend agora.</p>
            <CatalogSummaryView catalog={catalog} onRetry={onRetryCatalog} />
          </section>

          <section className={styles.block} aria-labelledby="home-notes-title">
            <div className={styles.blockHeader}>
              <h2 id="home-notes-title" className={styles.sectionTitle}>
                Notas
              </h2>
              <span className={styles.blockRef} aria-hidden="true">
                valem para toda a aplicação
              </span>
            </div>
            <ol className={styles.footnotes}>
              <li role="note">
                <strong>Dados FICTÍCIOS</strong>
                <span>
                  Guindastes, fichas e tabelas usados até agora são fictícios, até a empresa
                  fornecer os dados oficiais (ADR-012). Não use os valores em operação real.
                </span>
              </li>
              <li role="note">
                <strong>Estratégia PROVISÓRIA</strong>
                <span>
                  A capacidade vem da consulta conservadora: um ponto da tabela, do lado seguro, sem
                  interpolação (ADR-015). Não é o valor definitivo.
                </span>
              </li>
              <li role="note">
                <strong>O backend decide</strong>
                <span>
                  A geometria desenhada no navegador é só pré-visualização. Capacidade e utilização
                  são calculadas no backend (RN-008).
                </span>
              </li>
            </ol>
          </section>
        </aside>
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
            <Skeleton width={36} height={18} />
            <Skeleton width="45%" height={10} />
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
        icon={<Unplug size={16} />}
        title="Não foi possível ler o catálogo"
        description={
          <>
            {catalog.message} Confira se o backend está no ar (com o banco configurado) e tente de
            novo.
          </>
        }
        action={
          <Button size="sm" icon={<RefreshCw size={12} />} onClick={onRetry}>
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
        icon={<Building2 size={16} />}
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
        <Stat label="Fabricantes" value={summary.manufacturers} />
        <Stat label="Guindastes" value={summary.cranes} />
        <Stat label="Configurações" value={summary.configurations} />
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
            <span>
              {summary.configurations - summary.configurationsWithSheet} configuração(ões) sem ficha
              técnica: a avaliação delas responde “não avaliável”.
            </span>
          </p>
        )}
      </div>
    </div>
  )
}

/** Linha da tabela de contagens: o número vem primeiro no DOM e o CSS o leva para a direita. */
function Stat({ label, value }: { readonly label: string; readonly value: number }) {
  return (
    <div className={styles.stat} role="listitem">
      <span className={styles.statValue}>{value.toLocaleString('pt-BR')}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  )
}
