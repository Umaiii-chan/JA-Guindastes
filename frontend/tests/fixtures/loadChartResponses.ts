// FICTÍCIO: respostas no formato do backend da TASK-031 (importação e ativação). Não são de nenhum
// guindaste nem tabela real.

const SOURCE = {
  file_name: 'tabela-ficticia.csv',
  file_type: 'text/csv',
  sha256: 'a'.repeat(64),
  uri: `local://${'a'.repeat(64)}`,
}

const POINTS = [
  { boom_length_m: 20, working_radius_m: 10, max_capacity_kg: 5000 },
  { boom_length_m: 20, working_radius_m: 15.5, max_capacity_kg: 3200 },
]

export const IMPORTED_DRAFT = {
  chart_id: 'TAB-FICTICIA-1',
  version: 'v2',
  configuration_id: 'CFG-FICTICIA',
  status: 'DRAFT',
  point_count: POINTS.length,
  points: POINTS,
  source: SOURCE,
}

export const INVALID_REPORT = {
  chart_id: 'TAB-FICTICIA-1',
  version: 'v2',
  configuration_id: 'CFG-FICTICIA',
  status: 'INVALID',
  point_count: 0,
  points: [],
  issues: [
    {
      code: 'MISSING_COLUMN',
      message: 'Coluna obrigatória ausente: max_capacity_kg.',
      line: null,
      column: 'max_capacity_kg',
    },
    {
      code: 'INVALID_NUMBER',
      message: 'Valor não numérico: "abc".',
      line: 3,
      column: 'working_radius_m',
    },
  ],
}

export const ACTIVATED_SUPERSEDING = {
  ...IMPORTED_DRAFT,
  status: 'ACTIVE',
  superseded_chart_id: 'TAB-FICTICIA-0',
}

export const ACTIVATED_FIRST = { ...IMPORTED_DRAFT, status: 'ACTIVE', superseded_chart_id: null }
