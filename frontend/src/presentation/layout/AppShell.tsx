import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'

import { cx, IconButton } from '../ui'
import styles from './AppShell.module.css'
import { MAIN_SHEET_COUNT, NAV_ITEMS, type NavItem, navItemFor } from './navigation'
import { Wordmark } from './Wordmark'

const RAIL_STORAGE_KEY = 'ja-guindastes.rail-collapsed'
/** Abaixo desta largura o trilho começa recolhido (mais espaço para a cena). */
const AUTO_COLLAPSE_BELOW_PX = 1360
/** Revisão mostrada no carimbo: a versão da aplicação (package.json). */
const REVISION = '0.1'

function initialCollapsed(): boolean {
  try {
    const stored = window.localStorage.getItem(RAIL_STORAGE_KEY)
    if (stored !== null) return stored === '1'
  } catch {
    // Sem armazenamento (modo privado, bloqueado): decide pela largura.
  }
  return typeof window !== 'undefined' && window.innerWidth < AUTO_COLLAPSE_BELOW_PX
}

/** "02/04" para as folhas do índice; só "A1" para as da administração. */
function sheetLabel(item: NavItem): string {
  return item.section === 'main'
    ? `${item.sheet}/${String(MAIN_SHEET_COUNT).padStart(2, '0')}`
    : item.sheet
}

export interface AppShellProps {
  /** Espaço do menu do usuário na barra superior (nome, perfil, sair — TASK-040). */
  readonly userMenu: ReactNode
  /** Ações globais da barra superior, antes do menu do usuário (ex.: ajuda). */
  readonly topBarActions?: ReactNode
  /** Conteúdo da página; sem ele, usa o `<Outlet />` do roteador. */
  readonly children?: ReactNode
  /** Quais itens do trilho mostrar (perfis, TASK-040). Padrão: todos. */
  readonly isNavItemVisible?: (item: NavItem) => boolean
}

const SHOW_ALL = () => true

/**
 * Casca da aplicação (ADR-017 § 1, com o visual do ADR-019): trilho recolhível com o wordmark e o
 * índice numerado das folhas; barra superior como carimbo de prancha (número, título, folha e
 * revisão) com a ajuda e o menu do usuário. A página do simulador ocupa a área inteira.
 */
export function AppShell({
  userMenu,
  topBarActions,
  children,
  isNavItemVisible = SHOW_ALL,
}: AppShellProps) {
  const [collapsed, setCollapsed] = useState(initialCollapsed)
  const location = useLocation()
  const current = navItemFor(location.pathname)

  useEffect(() => {
    try {
      window.localStorage.setItem(RAIL_STORAGE_KEY, collapsed ? '1' : '0')
    } catch {
      // Preferência só da sessão quando não há armazenamento.
    }
  }, [collapsed])

  const visibleItems = NAV_ITEMS.filter((item) => isNavItemVisible(item))
  const mainItems = visibleItems.filter((item) => item.section === 'main')
  const adminItems = visibleItems.filter((item) => item.section === 'admin')

  const renderItem = (item: NavItem) => (
    <li key={item.path}>
      <NavLink
        to={item.path}
        end={item.path === '/'}
        className={({ isActive }) => cx(styles.navLink, isActive && styles.navLinkActive)}
        title={collapsed ? item.label : undefined}
      >
        <span className={styles.navSheet} aria-hidden="true">
          {item.sheet}
        </span>
        <span className={styles.navLabel}>{item.label}</span>
      </NavLink>
    </li>
  )

  return (
    <div className={cx(styles.shell, collapsed && styles.collapsed)}>
      <a className={styles.skipLink} href="#conteudo">
        Pular para o conteúdo
      </a>
      <nav className={styles.rail} aria-label="Navegação principal">
        <div className={styles.brand}>
          <Wordmark compact={collapsed} />
        </div>
        <p className={styles.navSection}>Índice</p>
        <ul className={styles.navList}>{mainItems.map(renderItem)}</ul>
        {adminItems.length > 0 && (
          <>
            <p className={styles.navSection}>Administração</p>
            <ul className={styles.navList}>{adminItems.map(renderItem)}</ul>
          </>
        )}
        <div className={styles.railFooter}>
          <IconButton
            label={collapsed ? 'Expandir menu' : 'Recolher menu'}
            icon={collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            tooltip="right"
            size="sm"
            aria-expanded={!collapsed}
            onClick={() => setCollapsed((value) => !value)}
          />
          <span className={styles.version}>v{REVISION}</span>
        </div>
      </nav>
      <div className={styles.main}>
        <header className={styles.topBar}>
          <span className={styles.titleSheet} aria-hidden="true">
            {current?.sheet ?? '—'}
          </span>
          <div className={styles.titles}>
            <h1 className={styles.pageTitle}>{current?.label ?? 'Página não encontrada'}</h1>
            {current && <p className={styles.pageDescription}>{current.description}</p>}
          </div>
          {current && (
            <dl className={styles.titleBlock} aria-label="Carimbo da folha">
              <div className={styles.titleCell}>
                <dt>Folha</dt>
                <dd>{sheetLabel(current)}</dd>
              </div>
              <div className={styles.titleCell}>
                <dt>Rev.</dt>
                <dd>{REVISION}</dd>
              </div>
            </dl>
          )}
          <div className={styles.topBarActions}>
            {topBarActions}
            <div className={styles.userSlot}>{userMenu}</div>
          </div>
        </header>
        <main
          id="conteudo"
          tabIndex={-1}
          className={cx(styles.content, current?.fullBleed && styles.fullBleed)}
        >
          {children ?? <Outlet />}
        </main>
      </div>
    </div>
  )
}
