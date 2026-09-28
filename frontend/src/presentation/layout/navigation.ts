// Rotas e itens de navegação da casca (ADR-017 § 1; TASK-039). `/login` fica fora da casca.
// Visual de manual técnico (ADR-019): cada página é uma "folha" com número, como no índice de um
// manual; o número aparece no trilho (sem ícones decorativos) e no carimbo da barra superior.

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
  /** Número da folha no índice (ex.: "02"); o trilho recolhido mostra só ele. */
  readonly sheet: string
  /** `admin`: seção do administrador (perfis chegam com a TASK-040). */
  readonly section: 'main' | 'admin'
  /** A página ocupa a área inteira, sem margens (cena 3D). */
  readonly fullBleed?: boolean
}

export const NAV_ITEMS: readonly NavItem[] = [
  {
    path: ROUTES.home,
    label: 'Início',
    description: 'Índice, resumo do catálogo e notas',
    sheet: '01',
    section: 'main',
  },
  {
    path: ROUTES.simulator,
    label: 'Simulador',
    description: 'Guindaste, carga e posição, com o resultado do backend',
    sheet: '02',
    section: 'main',
    fullBleed: true,
  },
  {
    path: ROUTES.catalog,
    label: 'Catálogo',
    description: 'Fabricantes, guindastes e configurações',
    sheet: '03',
    section: 'main',
  },
  {
    path: ROUTES.tables,
    label: 'Tabelas',
    description: 'Importar e ativar tabelas de carga',
    sheet: '04',
    section: 'main',
  },
  {
    path: ROUTES.users,
    label: 'Usuários',
    description: 'Contas e perfis de acesso',
    sheet: 'A1',
    section: 'admin',
  },
]

/** Quantas folhas tem o índice principal (o "de" de "FOLHA 02/04"). */
export const MAIN_SHEET_COUNT = NAV_ITEMS.filter((item) => item.section === 'main').length

/** Item de navegação da rota atual (`null` para rotas fora do menu, como a página não encontrada). */
export function navItemFor(pathname: string): NavItem | null {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  return NAV_ITEMS.find((item) => item.path === normalized) ?? null
}
