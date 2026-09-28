// Catálogo FICTÍCIO para os testes do frontend (ADR-012; ADR-013 C-4, regra 2): nenhum destes
// fabricantes, modelos, configurações ou fichas descreve um guindaste real.

import type { CraneTechnicalSheet } from '../../src/domain/catalog/catalog'
import type { CraneGeometryDto } from '../../src/infrastructure/api/catalogContract'
import type { FakeCatalogData } from '../helpers/fakeCatalogFetch'

/** Ficha FICTÍCIA completa, como o backend a devolve. */
export const GEOMETRY_DTO_FICTICIA: CraneGeometryDto = {
  boom_pivot_offset_m: 0.8,
  boom_pivot_height_m: 2.6,
  boom_length_min_m: 10,
  boom_length_max_m: 30,
  boom_angle_min_deg: 5,
  boom_angle_max_deg: 75,
  cable_length_min_m: 0.5,
  cable_length_max_m: 40,
  turret_rotation_min_deg: -90,
  turret_rotation_max_deg: 90,
}

/** A mesma ficha, com os nomes do frontend. */
export const SHEET_FICTICIA: CraneTechnicalSheet = {
  boomPivotOffsetM: 0.8,
  boomPivotHeightM: 2.6,
  boomLengthMinM: 10,
  boomLengthMaxM: 30,
  boomAngleMinDeg: 5,
  boomAngleMaxDeg: 75,
  cableLengthMinM: 0.5,
  cableLengthMaxM: 40,
  turretRotationMinDeg: -90,
  turretRotationMaxDeg: 90,
}

/** Ficha FICTÍCIA só com os campos obrigatórios (sem c_max e sem limites de giro). */
export const SHEET_MINIMA_FICTICIA: CraneTechnicalSheet = {
  ...SHEET_FICTICIA,
  cableLengthMaxM: null,
  turretRotationMinDeg: null,
  turretRotationMaxDeg: null,
}

/**
 * Zonas FICTÍCIAS no formato "frontal 110° / lateral e traseira 250°" (ADR-018; TASK-046), como o
 * backend as devolve. Não vêm de nenhuma tabela real.
 */
export const ZONAS_DTO_FICTICIAS = [
  { code: 'FRONTAL', name: 'Frontal FICTÍCIA', start_deg: 305, end_deg: 55 },
  { code: 'LATERAL_TRASEIRA', name: 'Lateral e traseira FICTÍCIA', start_deg: 55, end_deg: 305 },
]

/** As mesmas zonas, com os nomes do frontend. */
export const ZONAS_FICTICIAS = [
  { code: 'FRONTAL', name: 'Frontal FICTÍCIA', startDeg: 305, endDeg: 55 },
  { code: 'LATERAL_TRASEIRA', name: 'Lateral e traseira FICTÍCIA', startDeg: 55, endDeg: 305 },
]

/** Peso do gancho FICTÍCIO (kg). */
export const GANCHO_FICTICIO_KG = 180

/** O catálogo FICTÍCIO com a `CFG-A1-FICHA` em duas zonas e com peso do gancho (TASK-046). */
export function catalogComZonasFicticio(): FakeCatalogData {
  const data = catalogFicticio()
  data.configurations = data.configurations.map((row) =>
    row.id === 'CFG-A1-FICHA'
      ? {
          ...row,
          rotation_zones: ZONAS_DTO_FICTICIAS.map((zone) => ({ ...zone })),
          hook_block_weight_kg: GANCHO_FICTICIO_KG,
        }
      : row,
  )
  return data
}

/** Dois fabricantes, cada um com guindastes, e configurações com e sem ficha. */
export function catalogFicticio(): FakeCatalogData {
  return {
    manufacturers: [
      { id: 'FAB-A', name: 'Fabricante FICTÍCIO A' },
      { id: 'FAB-B', name: 'Fabricante FICTÍCIO B' },
    ],
    cranes: [
      { id: 'GUI-A1', manufacturer_id: 'FAB-A', model_name: 'Modelo FICTÍCIO A1' },
      { id: 'GUI-A2', manufacturer_id: 'FAB-A', model_name: 'Modelo FICTÍCIO A2' },
      { id: 'GUI-B1', manufacturer_id: 'FAB-B', model_name: 'Modelo FICTÍCIO B1' },
    ],
    configurations: [
      {
        id: 'CFG-A1-FICHA',
        crane_id: 'GUI-A1',
        name: 'Config FICTÍCIA com ficha',
        geometry: GEOMETRY_DTO_FICTICIA,
      },
      { id: 'CFG-A1-SEM', crane_id: 'GUI-A1', name: 'Config FICTÍCIA sem ficha', geometry: null },
      {
        id: 'CFG-B1',
        crane_id: 'GUI-B1',
        name: 'Config FICTÍCIA B1',
        geometry: GEOMETRY_DTO_FICTICIA,
      },
    ],
  }
}
