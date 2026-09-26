import { Mesh, type Scene } from 'three'

import { CraneController, type CraneRig } from '../crane/CraneController'
import { createProvisionalCrane } from '../crane/createProvisionalCrane'
import {
  PROVISIONAL_CRANE_INITIAL_STATE,
  PROVISIONAL_CRANE_SETUP,
} from '../crane/provisionalCraneSpec'
import type { CraneSetup } from '../crane/types'
import { addEnvironment, type SceneEnvironment } from './addEnvironment'
import { createScene } from './createScene'
import { HookLoad } from './HookLoad'
import { RadiusIndicator } from './RadiusIndicator'

export interface CraneSceneContents {
  readonly scene: Scene
  readonly rig: CraneRig
  readonly crane: CraneController
  /** Céu, luzes, chão e grade (TASK-041). */
  readonly environment: SceneEnvironment
  /** Anel de raio, arco de alcance e âncora do rótulo, no chão (TASK-041). */
  readonly radiusIndicator: RadiusIndicator
  /** Carga pendurada no gancho e halo de situação (TASK-041). */
  readonly hookLoad: HookLoad
}

/**
 * Monta a cena sem renderer: ambiente (céu, luzes, chão, grade), guindaste provisório com seu
 * controller, anel de raio e carga no gancho. Separada de `mountCraneScene` para poder ser testada
 * sem WebGL.
 *
 * O guindaste fica na origem da cena (ponto O do ADR-013). Os mesmos parâmetros a e h de `setup`
 * posicionam o pino da lança no modelo e entram no cálculo de `getOperationalGeometry()`, para o
 * gancho desenhado coincidir com o G calculado; a lança do modelo vai de `limits.boomLengthM.min`
 * (recolhida) a `max` (estendida). Sem `setup`, valem os valores FICTÍCIOS da PoC (TASK-033).
 * O anel e a carga são só desenho: não mudam a cinemática nem o cálculo (ADR-013 C-7).
 */
export function buildCraneScene(setup: CraneSetup = PROVISIONAL_CRANE_SETUP): CraneSceneContents {
  const scene = createScene()
  const environment = addEnvironment(scene)
  const rig = createProvisionalCrane(
    {
      boomRetractedLengthM: setup.limits.boomLengthM.min,
      boomExtendedLengthM: setup.limits.boomLengthM.max,
    },
    setup.geometryParameters,
  )
  // Sombras suaves do guindaste no chão (CA-1); não muda nenhum nó do rig.
  rig.base.traverse((object) => {
    if (object instanceof Mesh) {
      object.castShadow = true
      object.receiveShadow = true
    }
  })
  scene.add(rig.base)
  const crane = new CraneController(
    rig,
    setup.limits,
    setup.geometryParameters,
    PROVISIONAL_CRANE_INITIAL_STATE,
  )

  const radiusIndicator = new RadiusIndicator(setup.limits, setup.geometryParameters)
  scene.add(radiusIndicator.root)
  environment.fitShadowToReach(radiusIndicator.reach.maxM)
  const hookLoad = new HookLoad(rig.hook)

  radiusIndicator.update({
    workingRadiusM: crane.getOperationalGeometry().workingRadiusM,
    turretRotationDeg: crane.getState().turretRotationDeg,
  })
  return { scene, rig, crane, environment, radiusIndicator, hookLoad }
}
