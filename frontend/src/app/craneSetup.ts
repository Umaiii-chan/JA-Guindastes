// Limites dos sliders e parâmetros a e h da pré-visualização a partir da configuração escolhida
// (TASK-033). Com ficha técnica (ADR-013 C-4), valem os valores dela; sem ficha, os FICTÍCIOS do
// guindaste provisório (ADR-012), sempre rotulados na tela. Nada disso decide capacidade ou segurança:
// quem valida o estado com a ficha é o backend (RN-008; ADR-013 C-7).

import type { CraneConfiguration } from '../domain/catalog/catalog'
import {
  PROVISIONAL_CRANE_LIMITS,
  PROVISIONAL_CRANE_SETUP,
} from '../three/crane/provisionalCraneSpec'
import type { CraneLimits, CraneSetup } from '../three/crane/types'

export type CraneLimitKey = keyof CraneLimits

export interface CraneSetupChoice {
  readonly setup: CraneSetup
  /** `true` quando limites e a/h saíram da ficha técnica da configuração. */
  readonly fromSheet: boolean
  /** Aviso geral para o painel dos controles (de onde vêm os limites). */
  readonly notice: string
  /** Observação por controle quando um limite não veio da ficha. */
  readonly notes: Readonly<Partial<Record<CraneLimitKey, string>>>
}

/** Faixa do slider de giro quando a ficha não tem ψ_min/ψ_max (giro contínuo: uma volta). */
export const CONTINUOUS_TURRET_RANGE = { min: -180, max: 180 } as const

const FICTITIOUS_NOTICE_SUFFIX =
  'limites padrão do guindaste de exemplo. Cadastre a ficha técnica para avaliar.'

function provisional(reason: string): CraneSetupChoice {
  return {
    setup: PROVISIONAL_CRANE_SETUP,
    fromSheet: false,
    notice: `${reason}: ${FICTITIOUS_NOTICE_SUFFIX}`,
    notes: {},
  }
}

export function chooseCraneSetup(configuration: CraneConfiguration | null): CraneSetupChoice {
  if (configuration === null) return provisional('Nenhuma configuração escolhida')
  const sheet = configuration.geometry
  if (sheet === null) {
    return provisional(`A configuração "${configuration.name}" não tem ficha técnica`)
  }
  // O modelo provisório desenha a lança recolhida com L_min; comprimento zero não tem desenho.
  if (!(sheet.boomLengthMinM > 0)) {
    return provisional(
      `A ficha de "${configuration.name}" tem lança mínima de 0 m, que o modelo 3D não desenha`,
    )
  }

  const notes: Partial<Record<CraneLimitKey, string>> = {}
  let turretRotationDeg: { min: number; max: number }
  if (sheet.turretRotationMinDeg !== null && sheet.turretRotationMaxDeg !== null) {
    turretRotationDeg = { min: sheet.turretRotationMinDeg, max: sheet.turretRotationMaxDeg }
  } else {
    turretRotationDeg = { ...CONTINUOUS_TURRET_RANGE }
    notes.turretRotationDeg = 'Giro contínuo (a ficha não limita o giro).'
  }
  let cableMax: number
  if (sheet.cableLengthMaxM !== null) {
    cableMax = sheet.cableLengthMaxM
  } else {
    cableMax = Math.max(sheet.cableLengthMinM, PROVISIONAL_CRANE_LIMITS.cableLengthM.max)
    notes.cableLengthM = 'A ficha não informa o cabo máximo; usado o padrão.'
  }

  return {
    setup: {
      limits: {
        turretRotationDeg,
        boomAngleDeg: { min: sheet.boomAngleMinDeg, max: sheet.boomAngleMaxDeg },
        boomLengthM: { min: sheet.boomLengthMinM, max: sheet.boomLengthMaxM },
        cableLengthM: { min: sheet.cableLengthMinM, max: cableMax },
      },
      geometryParameters: {
        boomPivotOffsetM: sheet.boomPivotOffsetM,
        boomPivotHeightM: sheet.boomPivotHeightM,
      },
    },
    fromSheet: true,
    notice: `Limites e parâmetros a/h da ficha técnica de "${configuration.name}". Guindaste 3D provisório; sem cálculo de capacidade no navegador.`,
    notes,
  }
}
