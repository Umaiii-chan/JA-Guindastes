import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'

import { cx, IconButton } from '../ui'
import styles from './AppShell.module.css'
import { BrandMark } from './BrandMark'
import { NAV_ITEMS, type NavItem, navItemFor } from './navigation'

const RAIL_STORAGE_KEY = 'ja-guindastes.rail-collapsed'
/** Abaixo desta largura o trilho começa recolhido (mais espaço para a cena). */
const AUTO_COLLAPSE_BELOW_PX = 1360

function initialCollapsed(): boolean {
  try {
    const stored = window.localStorage.getItem(RAIL_STORAGE_KEY)
    if (stored !== null) return stored === '1'
  } catch {
    // Sem armazenamento (modo privado, bloqueado): decide pela largura.
  }
  return typeof window !== 'undefined' && window.innerWidth < AUTO_COLLAPSE_BELOW_PX
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
 * Casca da aplicação (ADR-017 § 1): trilho de navegação recolhível com ícones à esquerda e barra
 * superior com o título da página e o menu do usuário. A página do simulador ocupa a área inteira.
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

  const renderItem = (item: (typeof NAV_ITEMS)[number]) => {
    const Icon = item.icon
    return (
      <li key={item.path}>
        <NavLink
          to={item.path}
          end={item.path === '/'}
          className={({ isActive }) => cx(styles.navLink, isActive && styles.navLinkActive)}
          title={collapsed ? item.label : undefined}
        >
          <span className={styles.navIcon} aria-hidden="true">
            <Icon size={18} strokeWidth={1.8} />
          </span>
          <span className={styles.navLabel}>{item.label}</span>
        </NavLink>
      </li>
    )
  }

  return (
    <div className={cx(styles.shell, collapsed && styles.collapsed)}>
      <a className={styles.skipLink} href="#conteudo">
        Pular para o conteúdo
      </a>
      <nav className={styles.rail} aria-label="Navegação principal">
        <div className={styles.brand}>
          <BrandMark size={30} />
          <span className={styles.brandText}>
            <span className={styles.brandName}>JA Guindastes</span>
            <span className={styles.brandTagline}>Simulador de carga</span>
          </span>
        </div>
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
            icon={collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            tooltip="right"
            aria-expanded={!collapsed}
            onClick={() => setCollapsed((value) => !value)}
          />
          <span className={styles.version}>v0.1 · FICTÍCIO</span>
        </div>
      </nav>
      <div className={styles.main}>
        <header className={styles.topBar}>
          <div className={styles.titles}>
            <h1 className={styles.pageTitle}>{current?.label ?? 'Página não encontrada'}</h1>
            {current && <p className={styles.pageDescription}>{current.description}</p>}
          </div>
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
