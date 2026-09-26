import type { CraneKinematicsCalibrationTolerance } from '../crane/craneKinematics'
import {
  type LoadedTruckCraneModel,
  loadTruckCraneModel,
  mapTruckCraneKinematics,
} from '../loaders/loadTruckCraneModel'
import type { CraneSceneContents } from './buildCraneScene'
import { disposeObject3D } from './disposeObject3D'

// Troca do guindaste provisório pelo modelo 3D ilustrativo (GLB da TASK-043) depois que ele carrega
// (TASK-041). Enquanto o GLB baixa, a cena mostra o provisório; se o download falhar ou o mapeamento
// recusar o modelo, ela continua nele, com aviso no console e sem erro para a UI.
//
// Os limites e os parâmetros a e h continuam vindo da ficha técnica (`contents.setup`), nunca do GLB
// (RN-003; ADR-013 C-4, regra 1): o mapeamento só compara o modelo com eles.

/** Baixa o modelo; recebe o sinal para abortar quando a cena é desmontada antes do fim. */
export type CraneModelLoader = (signal: AbortSignal) => Promise<LoadedTruckCraneModel>

/** Bytes do GLB já baixados: trocar a configuração remonta a cena, e o arquivo tem ~1,8 MB. */
let cachedGlb: Promise<ArrayBuffer> | null = null

/**
 * `fetch` que guarda os bytes da primeira resposta bem-sucedida e os reaproveita nas montagens
 * seguintes (cada montagem ainda interpreta o GLB de novo, porque a cena anterior foi liberada).
 * Respostas de erro passam direto, para `loadGltf` classificá-las, e não ficam guardadas.
 */
const cachingFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  if (cachedGlb) return new Response((await cachedGlb).slice(0), { status: 200 })
  const response = await fetch(input, init)
  if (!response.ok) return response
  const bytes = response.arrayBuffer()
  cachedGlb = bytes
  bytes.catch(() => {
    if (cachedGlb === bytes) cachedGlb = null
  })
  return new Response((await bytes).slice(0), { status: 200 })
}) as typeof fetch

/** Carregador padrão: o GLB público `models/guindaste-caminhao.glb`, baixado uma vez por página. */
export const loadDefaultCraneModel: CraneModelLoader = (signal) =>
  loadTruckCraneModel(undefined, { signal, fetch: cachingFetch })

/**
 * Tolerância da conferência de calibração na cena. Só decide o que vira aviso no console: um desvio
 * maior não impede usar o modelo (o erro é só visual, ADR-013 C-4, regra 3). A tolerância de
 * engenharia continua em aberto (ADR-013, G-7).
 */
export const SCENE_CALIBRATION_TOLERANCE: CraneKinematicsCalibrationTolerance = {
  positionM: 0.01,
  rotationDeg: 0.5,
}

export type CraneModelUpgradeResult =
  | { readonly status: 'model'; readonly warnings: readonly string[] }
  | {
      readonly status: 'provisional'
      readonly reason: 'load-failed' | 'mapping-rejected' | 'cancelled'
      readonly detail: string
    }

/** Quem recebe os avisos (o `console` por padrão; injetável nos testes). */
export interface UpgradeLogger {
  warn(...data: unknown[]): void
}

export interface UpgradeCraneModelOptions {
  readonly signal?: AbortSignal
  readonly logger?: UpgradeLogger
}

/**
 * Carrega o modelo com `load`, mapeia-o com a ficha da cena e, se der certo, troca o guindaste
 * (`CraneSceneContents.useModel`), preservando o estado dos comandos. Nunca rejeita: o resultado diz
 * se a cena ficou no modelo ou no provisório. Cancelado (`signal`), libera o que tiver carregado.
 */
export async function upgradeCraneModel(
  contents: CraneSceneContents,
  load: CraneModelLoader,
  options: UpgradeCraneModelOptions = {},
): Promise<CraneModelUpgradeResult> {
  const signal = options.signal ?? new AbortController().signal
  const logger = options.logger ?? console

  let model: LoadedTruckCraneModel
  try {
    model = await load(signal)
  } catch (error) {
    if (signal.aborted) return cancelled()
    const detail = error instanceof Error ? error.message : String(error)
    logger.warn(
      `[cena 3D] Modelo 3D não carregou; a cena continua com o guindaste provisório. ${detail}`,
    )
    return { status: 'provisional', reason: 'load-failed', detail }
  }

  if (signal.aborted) {
    disposeObject3D(model.scene)
    return cancelled()
  }

  const { setup } = contents
  const result = mapTruckCraneKinematics(model, {
    geometryParameters: setup.geometryParameters,
    boomRetractedLengthM: setup.limits.boomLengthM.min,
    calibrationTolerance: SCENE_CALIBRATION_TOLERANCE,
  })
  if (!result.ok) {
    disposeObject3D(model.scene)
    const detail = result.report.errors.map((error) => error.message).join(' ')
    logger.warn(
      `[cena 3D] Modelo 3D recusado pelo mapeamento; a cena continua com o guindaste provisório. ${detail}`,
    )
    return { status: 'provisional', reason: 'mapping-rejected', detail }
  }

  try {
    contents.useModel({
      root: model.scene,
      rig: result.rig,
      afterCommand: model.updateLuffingCylinder,
    })
  } catch (error) {
    // Por exemplo, limites da ficha incompatíveis com o rig: fica no provisório.
    disposeObject3D(model.scene)
    const detail = error instanceof Error ? error.message : String(error)
    logger.warn(
      `[cena 3D] Modelo 3D não pôde ser usado; a cena continua com o guindaste provisório. ${detail}`,
    )
    return { status: 'provisional', reason: 'mapping-rejected', detail }
  }

  const warnings = result.report.warnings.map((warning) => warning.message)
  if (warnings.length > 0) {
    logger.warn(
      `[cena 3D] Modelo 3D em uso, com diferenças de calibração (só visuais, ADR-013 C-4): ${warnings.join(' ')}`,
    )
  }
  return { status: 'model', warnings }
}

function cancelled(): CraneModelUpgradeResult {
  return { status: 'provisional', reason: 'cancelled', detail: 'cena desmontada' }
}
