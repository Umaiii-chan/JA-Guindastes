// Rotas e itens de navegação da casca (ADR-017 § 1; TASK-039). `/login` fica fora da casca.

import { Axis3d, Construction, House, type LucideIcon, Table2, Users } from 'lucide-react'

export const ROUTES = {
  home: '/',
  simulator: '/simulador',
  catalog: '/catalogo',
  tables: '/tabelas',
  users: '/usuarios',
  login: '/login',
} as const

export interface NavItem {
  readonly path: string
  readonly label: string
  /** Linha de apoio na barra superior. */
  readonly description: string
  readonly icon: LucideIcon
  /** `admin`: seção do administrador (perfis chegam com a TASK-040). */
  readonly section: 'main' | 'admin'
  /** A página ocupa a área inteira, sem margens (cena 3D). */
  readonly fullBleed?: boolean
}

export const NAV_ITEMS: readonly NavItem[] = [
  {
    path: ROUTES.home,
    label: 'Início',
    description: 'Atalhos, resumo do catálogo e avisos',
    icon: House,
    section: 'main',
  },
  {
    path: ROUTES.simulator,
    label: 'Simulador',
    description: 'Guindaste, carga e posição, com o resultado do backend',
    icon: Axis3d,
    section: 'main',
    fullBleed: true,
  },
  {
    path: ROUTES.catalog,
    label: 'Catálogo',
    description: 'Fabricantes, guindastes e configurações',
    icon: Construction,
    section: 'main',
  },
  {
    path: ROUTES.tables,
    label: 'Tabelas',
    description: 'Importar e ativar tabelas de carga',
    icon: Table2,
    section: 'main',
  },
  {
    path: ROUTES.users,
    label: 'Usuários',
    description: 'Contas e perfis de acesso',
    icon: Users,
    section: 'admin',
  },
]

/** Item de navegação da rota atual (`null` para rotas fora do menu, como a página não encontrada). */
export function navItemFor(pathname: string): NavItem | null {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  return NAV_ITEMS.find((item) => item.path === normalized) ?? null
}
