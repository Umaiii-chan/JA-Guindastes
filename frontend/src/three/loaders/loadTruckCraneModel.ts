import { type Group, type Object3D, Vector3 } from 'three'

import type { CraneGeometryParameters } from '../../domain/geometry/operationalGeometry'
import {
  type CraneKinematicsConfig,
  type CraneKinematicsNodeNames,
  type CraneKinematicsResult,
  mapCraneKinematics,
} from '../crane/craneKinematics'
import { type LoadedGltf, type LoadGltfOptions, loadGltf, parseGltf } from './loadGltf'

// Modelo 3D ILUSTRATIVO do guindaste sobre caminhão (TASK-043): GLB gerado por
// `frontend/scripts/convert-crane-model.mjs` a partir de um FBX do CGTrader e servido de
// `frontend/public/models/`. Não representa nenhum guindaste real. O GLB segue a hierarquia e a pose
// de repouso de `assets/example-models/README.md` (ADR-013 C-4, regra 4), com os mesmos nomes de nós
// do guindaste provisório. Nenhuma medida de cálculo é lida dele (RN-003): a, h e L_min vêm da
// configuração, e o mapeamento só compara o modelo com eles (aviso de calibração, erro só visual).

/** URL do GLB, relativa à base do Vite (`public/models/guindaste-caminhao.glb`). */
export const TRUCK_CRANE_MODEL_URL = `${import.meta.env.BASE_URL}models/guindaste-caminhao.glb`

/** Papel → nó do GLB, para `mapCraneKinematics` (todos os papéis, inclusive os opcionais). */
export const TRUCK_CRANE_NODE_NAMES = {
  base: 'crane-base',
  turret: 'crane-turret',
  boom: 'crane-boom',
  boomExtension: 'crane-boom-extension',
  boomTip: 'crane-boom-tip',
  cable: 'crane-cable',
  cableLine: 'crane-cable-line',
  hook: 'crane-hook',
} as const satisfies CraneKinematicsNodeNames

/**
 * Nós extras do cilindro de levantamento, fora dos papéis do mapeamento. Cada um gira só em X, e o
 * eixo da peça é o +Y local: a camisa (filha da torre) tem origem no pino de baixo e a haste (filha
 * da lança) no pino de cima.
 */
export const TRUCK_CRANE_LUFFING_NODE_NAMES = {
  cylinder: 'crane-luffing-cylinder',
  rod: 'crane-luffing-rod',
} as const

/**
 * Medidas do modelo ILUSTRATIVO na pose de repouso (m), como a conversão o deixou (também gravadas
 * nos `extras` do nó base, em `medidasDoModelo`). A escala foi escolhida pela ficha FICTÍCIA de demo
 * (h = 3,3 m; lança recolhida de 12 m, com os tubos esticados); o pino da lança ficou em a ≈ −1,56 m,
 * e a ficha de demo do backend passou a usar a = −1,56 m (`backend/app/demo_seed.py`). O padrão
 * FICTÍCIO do frontend (`PROVISIONAL_CRANE_GEOMETRY`) também, desde a TASK-041. Servem só de referência
 * para a conferência de calibração: nunca são entrada de cálculo (RN-003; ADR-013 C-4, regra 1).
 */
export const TRUCK_CRANE_MODEL_MEASUREMENTS = {
  boomPivotOffsetM: -1.5591,
  boomPivotHeightM: 3.3,
  boomRetractedLengthM: 12,
} as const satisfies CraneGeometryParameters & { readonly boomRetractedLengthM: number }

export interface LoadedTruckCraneModel {
  /** Resultado do `loadGltf`/`parseGltf` (cena, metadados e nomes de nós do arquivo). */
  readonly gltf: LoadedGltf
  /** Raiz da cena do GLB; `crane-base` é filho dela. */
  readonly scene: Group
  /** Nomes dos nós para `CraneKinematicsConfig.nodeNames`. */
  readonly nodeNames: CraneKinematicsNodeNames
  /**
   * Reaponta a camisa e a haste do cilindro de levantamento para a pose atual da lança. Chame depois
   * de mover a lança (`CraneController.setBoomAngle`/`setTurretRotation`); sem isso, o cilindro fica
   * na pose de repouso. Não faz nada se o GLB não tiver os nós do cilindro.
   */
  readonly updateLuffingCylinder: () => void
}

/** Baixa e interpreta o GLB do guindaste sobre caminhão (erros como em `loadGltf`). */
export async function loadTruckCraneModel(
  url: string = TRUCK_CRANE_MODEL_URL,
  options: LoadGltfOptions = {},
): Promise<LoadedTruckCraneModel> {
  return toTruckCraneModel(await loadGltf(url, options))
}

/** Interpreta o GLB já em memória (por exemplo, lido do disco nos testes). */
export async function parseTruckCraneModel(data: ArrayBuffer): Promise<LoadedTruckCraneModel> {
  return toTruckCraneModel(await parseGltf(data))
}

/**
 * Mapeia o modelo para o `CraneController` com os nós de `TRUCK_CRANE_NODE_NAMES` e os nomes do
 * arquivo (para denunciar nós repetidos). `config` traz a, h, L_min e as tolerâncias da ficha técnica.
 */
export function mapTruckCraneKinematics(
  model: LoadedTruckCraneModel,
  config: Omit<CraneKinematicsConfig, 'nodeNames'>,
): CraneKinematicsResult {
  return mapCraneKinematics(
    model.scene,
    { ...config, nodeNames: model.nodeNames },
    { sourceNodeNames: model.gltf.sourceNodeNames },
  )
}

function toTruckCraneModel(gltf: LoadedGltf): LoadedTruckCraneModel {
  const scene = gltf.scene
  const cylinder = scene.getObjectByName(TRUCK_CRANE_LUFFING_NODE_NAMES.cylinder)
  const rod = scene.getObjectByName(TRUCK_CRANE_LUFFING_NODE_NAMES.rod)
  return {
    gltf,
    scene,
    nodeNames: TRUCK_CRANE_NODE_NAMES,
    updateLuffingCylinder: () => {
      if (cylinder === undefined || rod === undefined) return
      const basePin = cylinder.getWorldPosition(new Vector3())
      const headPin = rod.getWorldPosition(new Vector3())
      aimLocalYAt(cylinder, headPin)
      aimLocalYAt(rod, basePin)
    },
  }
}

/** Gira `node` só em X para o seu +Y local apontar para `targetWorld` (os dois no plano YZ do pai). */
function aimLocalYAt(node: Object3D, targetWorld: Vector3): void {
  const parent = node.parent
  if (parent === null) return
  const direction = parent.worldToLocal(targetWorld.clone()).sub(node.position)
  // A rotação φ em X leva +Y para (0, cos φ, sin φ).
  node.rotation.set(Math.atan2(direction.z, direction.y), 0, 0)
}
