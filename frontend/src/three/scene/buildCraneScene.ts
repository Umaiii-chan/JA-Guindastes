import type { Scene } from 'three'

import { CraneController, type CraneRig } from '../crane/CraneController'
import {
  createProvisionalCrane,
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
 */
export function buildCraneScene(): CraneSceneContents {
  const scene = createScene()
  addEnvironment(scene)
  const rig = createProvisionalCrane()
  scene.add(rig.base)
  const crane = new CraneController(rig, PROVISIONAL_CRANE_LIMITS, PROVISIONAL_CRANE_INITIAL_STATE)
  return { scene, rig, crane }
}
