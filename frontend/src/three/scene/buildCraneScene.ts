import { Group, MathUtils, Mesh, type Object3D, type Scene } from 'three'

import { EMPTY_SCENARIO, type ScenarioSpec } from '../../domain/environment/environment'
import type { Vec3 } from '../camera/cameraPresets'
import { CraneController, type CraneRig } from '../crane/CraneController'
import { createProvisionalCrane } from '../crane/createProvisionalCrane'
import {
  PROVISIONAL_CRANE_INITIAL_STATE,
  PROVISIONAL_CRANE_SETUP,
} from '../crane/provisionalCraneSpec'
import { findOperatorEye } from '../crane/rigLandmarks'
import { SwitchableCrane } from '../crane/SwitchableCrane'
import type { CraneSetup } from '../crane/types'
import { addEnvironment, type SceneEnvironment } from './addEnvironment'
import { createScene } from './createScene'
import { disposeObject3D } from './disposeObject3D'
import { HookLoad } from './HookLoad'
import { OperatingAreaOverlay } from './OperatingAreaOverlay'
import { ObstacleMeshes } from './ObstacleMeshes'
import { RadiusIndicator } from './RadiusIndicator'
import { RotationZoneSectors } from './RotationZoneSectors'
import { SceneCollisions } from './SceneCollisions'

/** Modelo 3D que substitui o guindaste provisório (o GLB da TASK-043), já mapeado para um rig. */
export interface CraneModelSwap {
  /** Raiz a pôr na cena (a cena do GLB); `rig.base` descende dela. */
  readonly root: Object3D
  readonly rig: CraneRig
  /** Roda depois de cada comando: reaponta peças que só acompanham (cilindro de levantamento). */
  readonly afterCommand?: () => void
}

/**
 * Cena montada, sem renderer: ambiente, guindaste, anel de raio e carga no gancho.
 *
 * Começa com o guindaste provisório e pode trocar para o modelo 3D (`useModel`) sem mudar os
 * comandos que a UI recebeu (`crane`), os limites nem os parâmetros a e h da ficha (TASK-041).
 */
export class CraneSceneContents {
  readonly scene: Scene
  /** Comandos do guindaste; o mesmo objeto antes e depois da troca de modelo. */
  readonly crane: SwitchableCrane
  /** Fundo de papel, luzes, chão, sombra e grade (TASK-041; TASK-047). */
  readonly environment: SceneEnvironment
  /** Anel de raio, arco de alcance e âncora do rótulo, no chão (TASK-041). */
  readonly radiusIndicator: RadiusIndicator
  /** Carga pendurada no gancho e halo de situação (TASK-041). */
  readonly hookLoad: HookLoad
  /** Setores das zonas de giro no chão (TASK-046); vazio até a UI mandar as zonas. */
  readonly rotationZones: RotationZoneSectors
  /** Colisões da carga: cenário, corpo medido, guarda de comandos e destaque vermelho (TASK-053). */
  readonly collisions: SceneCollisions
  /** Área de operação verde, amarela e vermelha no chão (TASK-055); vazia até a UI mandar. */
  readonly operatingArea: OperatingAreaOverlay
  /** Limites e a/h com que a cena foi montada (ficha técnica ou FICTÍCIOS). */
  readonly setup: CraneSetup
  /**
   * Raiz do guindaste e dos desenhos que o acompanham (anel de raio e zonas de giro). O cenário
   * (TASK-052) o assenta na altura do terreno e o posiciona e gira por `CranePlacement`.
   */
  readonly craneAnchor: Group
  /** Obstáculos do cenário (TASK-052). */
  readonly obstacles: ObstacleMeshes

  private currentRig: CraneRig
  private currentRoot: Object3D
  private eye: Vec3 | null
  private modelInUse = false

  constructor(parts: {
    scene: Scene
    environment: SceneEnvironment
    rig: CraneRig
    crane: CraneController
    radiusIndicator: RadiusIndicator
    hookLoad: HookLoad
    rotationZones: RotationZoneSectors
    collisions: SceneCollisions
    operatingArea: OperatingAreaOverlay
    setup: CraneSetup
    craneAnchor: Group
    obstacles: ObstacleMeshes
  }) {
    this.scene = parts.scene
    this.environment = parts.environment
    this.currentRig = parts.rig
    this.currentRoot = parts.rig.base
    this.crane = new SwitchableCrane(parts.crane)
    this.radiusIndicator = parts.radiusIndicator
    this.hookLoad = parts.hookLoad
    this.rotationZones = parts.rotationZones
    this.collisions = parts.collisions
    this.operatingArea = parts.operatingArea
    this.setup = parts.setup
    this.craneAnchor = parts.craneAnchor
    this.obstacles = parts.obstacles
    this.eye = findOperatorEye(parts.rig)
  }

  /** Rig desenhado agora (provisório ou do modelo 3D). */
  get rig(): CraneRig {
    return this.currentRig
  }

  /** `true` depois que o modelo 3D substituiu o guindaste provisório. */
  get usingModel(): boolean {
    return this.modelInUse
  }

  /** Olho do operador medido no rig atual (base com ψ = 0), ou `null` sem vidro de cabine. */
  get operatorEye(): Vec3 | null {
    return this.eye
  }

  /**
   * Troca o guindaste provisório pelo modelo 3D, na mesma pose: o controller novo recebe o estado
   * atual, a carga e o halo passam para o gancho novo e o provisório é liberado. O anel continua
   * lendo a geometria do controller, que não muda (ADR-013 C-7). Só pode ser chamado uma vez.
   */
  useModel(model: CraneModelSwap): void {
    if (this.modelInUse) throw new Error('A cena já usa o modelo 3D.')
    // Primeiro o controller: se os limites não servirem para o rig, lança antes de mexer na cena.
    this.crane.switchTo(model.rig, model.afterCommand)
    enableShadows(model.root)
    this.craneAnchor.add(model.root)
    this.hookLoad.attachTo(model.rig.hook)
    this.collisions.setRig(model.rig)

    const previous = this.currentRoot
    previous.removeFromParent()
    disposeObject3D(previous)

    this.currentRig = model.rig
    this.currentRoot = model.root
    this.eye = findOperatorEye(model.rig)
    this.modelInUse = true
  }

  /**
   * Aplica o cenário (TASK-052; ADR-023): terreno, obstáculos e posição do guindaste. `null` volta ao
   * cenário vazio (o plano de sempre, guindaste na origem). O guindaste assenta em
   * `terrainHeightAt` no eixo de giro; o rumo gira o conjunto em torno do eixo Y (anti-horário visto
   * de cima; 0 = chassi como modelado, frente em +Z).
   */
  setScenario(scenario: ScenarioSpec | null): void {
    const spec = scenario ?? EMPTY_SCENARIO
    this.environment.setTerrain(spec.terrain)
    this.obstacles.setObstacles(spec.obstacles, (x, z) => this.environment.heightAt(x, z))
    const { x, z, headingDeg } = spec.crane
    const y = this.environment.heightAt(x, z)
    this.craneAnchor.position.set(x, y, z)
    this.craneAnchor.rotation.y = MathUtils.degToRad(headingDeg)
    this.environment.followCrane(x, y, z)
  }
}

/** Sombras suaves no chão (CA-1): malhas opacas projetam e recebem; vidro só recebe. */
function enableShadows(root: Object3D): void {
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    object.castShadow = !materials.some((material) => material.transparent)
    object.receiveShadow = true
  })
}

/**
 * Monta a cena sem renderer: ambiente (papel, luzes, chão, grade), guindaste provisório com seu
 * controller, anel de raio e carga no gancho. Separada de `mountCraneScene` para poder ser testada
 * sem WebGL. O modelo 3D entra depois, por `upgradeCraneModel` (carregamento assíncrono).
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
  enableShadows(rig.base)
  const craneAnchor = new Group()
  craneAnchor.name = 'crane-anchor'
  scene.add(craneAnchor)
  craneAnchor.add(rig.base)
  const crane = new CraneController(
    rig,
    setup.limits,
    setup.geometryParameters,
    PROVISIONAL_CRANE_INITIAL_STATE,
  )

  const radiusIndicator = new RadiusIndicator(setup.limits, setup.geometryParameters)
  craneAnchor.add(radiusIndicator.root)
  environment.fitShadowToReach(radiusIndicator.reach.maxM)
  const hookLoad = new HookLoad(rig.hook)
  // Setores das zonas até um pouco além do alcance máximo, para ficarem visíveis sob o anel.
  const rotationZones = new RotationZoneSectors({
    innerM: 1.5,
    outerM: Math.max(radiusIndicator.reach.maxM + 1.5, 6),
  })
  craneAnchor.add(rotationZones.root)
  const collisions = new SceneCollisions(rig, hookLoad, setup.geometryParameters)
  scene.add(collisions.highlight.root)
  const operatingArea = new OperatingAreaOverlay()
  scene.add(operatingArea.root)
  const obstacles = new ObstacleMeshes()
  scene.add(obstacles.root)

  radiusIndicator.update({
    workingRadiusM: crane.getOperationalGeometry().workingRadiusM,
    turretRotationDeg: crane.getState().turretRotationDeg,
  })
  return new CraneSceneContents({
    scene,
    environment,
    rig,
    crane,
    radiusIndicator,
    hookLoad,
    rotationZones,
    collisions,
    operatingArea,
    setup,
    craneAnchor,
    obstacles,
  })
}
