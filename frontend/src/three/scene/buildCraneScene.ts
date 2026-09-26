import type { Scene } from 'three'

import { CraneController, type CraneRig } from '../crane/CraneController'
import {
  createProvisionalCrane,
  PROVISIONAL_CRANE_DIMENSIONS,
  PROVISIONAL_CRANE_GEOMETRY,
  PROVISIONAL_CRANE_INITIAL_STATE,
  PROVISIONAL_CRANE_LIMITS,
} from '../crane/createProvisionalCrane'
import { addEnvironment } from './addEnvironment'
import { createScene } from './createScene'

export interface CraneSceneContents {
  readonly scene: Scene
  readonly rig: CraneRig
  readonly crane: CraneController
}

/**
 * Monta a cena da PoC sem renderer: ambiente (luzes, chão, grade) e guindaste provisório com seu
 * controller. Separada de `mountCraneScene` para poder ser testada sem WebGL.
 *
 * O guindaste fica na origem da cena (ponto O do ADR-013), e o mesmo `PROVISIONAL_CRANE_GEOMETRY`
 * (a e h FICTÍCIOS) posiciona o pino da lança no modelo e entra no cálculo de
 * `getOperationalGeometry()`, para o gancho desenhado coincidir com o G calculado.
 */
export function buildCraneScene(): CraneSceneContents {
  const scene = createScene()
  addEnvironment(scene)
  const rig = createProvisionalCrane(PROVISIONAL_CRANE_DIMENSIONS, PROVISIONAL_CRANE_GEOMETRY)
  scene.add(rig.base)
  const crane = new CraneController(
    rig,
    PROVISIONAL_CRANE_LIMITS,
    PROVISIONAL_CRANE_GEOMETRY,
    PROVISIONAL_CRANE_INITIAL_STATE,
  )
  return { scene, rig, crane }
}
