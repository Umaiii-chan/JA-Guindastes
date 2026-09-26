// Rótulos dos campos da ficha técnica (ADR-013 C-4), com o símbolo do ADR e a unidade (RN-006).

import type { SheetFieldKey } from '../../application/catalog/catalogForms'

export const SHEET_FIELD_LABELS: Readonly<Record<SheetFieldKey, string>> = {
  boomPivotOffsetM: 'a — do eixo de giro ao pino da lança (m, com sinal)',
  boomPivotHeightM: 'h — altura do pino da lança (m)',
  boomLengthMinM: 'L mín — lança recolhida (m)',
  boomLengthMaxM: 'L máx — lança estendida (m)',
  boomAngleMinDeg: 'θ mín — inclinação mínima (°)',
  boomAngleMaxDeg: 'θ máx — inclinação máxima (°)',
  cableLengthMinM: 'c mín — cabo mínimo (m)',
  cableLengthMaxM: 'c máx — cabo máximo (m, opcional)',
  turretRotationMinDeg: 'ψ mín — giro mínimo (°, opcional)',
  turretRotationMaxDeg: 'ψ máx — giro máximo (°, opcional)',
}
