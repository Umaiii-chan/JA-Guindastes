import type { Scene } from 'three'

import { CraneController, type CraneRig } from '../crane/CraneController'
import { createProvisionalCrane } from '../crane/createProvisionalCrane'
import {
  PROVISIONAL_CRANE_INITIAL_STATE,
  PROVISIONAL_CRANE_SETUP,
} from '../crane/provisionalCraneSpec'
import type { CraneSetup } from '../crane/types'
import { addEnvironment } from './addEnvironment'
import { createScene } from './createScene'

export interface CraneSceneContents {
  readonly scene: Scene
  readonly rig: CraneRig
  readonly crane: CraneController
}

/**
 * Monta a cena sem renderer: ambiente (luzes, chão, grade) e guindaste provisório com seu controller.
 * Separada de `mountCraneScene` para poder ser testada sem WebGL.
 *
 * O guindaste fica na origem da cena (ponto O do ADR-013). Os mesmos parâmetros a e h de `setup`
 * posicionam o pino da lança no modelo e entram no cálculo de `getOperationalGeometry()`, para o
 * gancho desenhado coincidir com o G calculado; a lança do modelo vai de `limits.boomLengthM.min`
 * (recolhida) a `max` (estendida). Sem `setup`, valem os valores FICTÍCIOS da PoC (TASK-033).
 */
export function buildCraneScene(setup: CraneSetup = PROVISIONAL_CRANE_SETUP): CraneSceneContents {
  const scene = createScene()
  addEnvironment(scene)
  const rig = createProvisionalCrane(
    {
      boomRetractedLengthM: setup.limits.boomLengthM.min,
      boomExtendedLengthM: setup.limits.boomLengthM.max,
    },
    setup.geometryParameters,
  )
  scene.add(rig.base)
  const crane = new CraneController(
    rig,
    setup.limits,
    setup.geometryParameters,
    PROVISIONAL_CRANE_INITIAL_STATE,
  )
  return { scene, rig, crane }
}
