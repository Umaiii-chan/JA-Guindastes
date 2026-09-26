// Rótulos e tons do status da tabela de carga (doc-fonte § 13.2), como a tela mostra.

import type { LoadChartStatus } from '../../application/loadChart/ports'
import type { Tone } from '../ui'

export const CHART_STATUS_LABEL: Readonly<Record<LoadChartStatus, string>> = {
  DRAFT: 'Rascunho',
  VALIDATED: 'Validada',
  ACTIVE: 'Ativa',
  SUPERSEDED: 'Substituída',
  INVALID: 'Inválida',
}

export const CHART_STATUS_TONE: Readonly<Record<LoadChartStatus, Tone>> = {
  DRAFT: 'info',
  VALIDATED: 'info',
  ACTIVE: 'ok',
  SUPERSEDED: 'neutral',
  INVALID: 'danger',
}
