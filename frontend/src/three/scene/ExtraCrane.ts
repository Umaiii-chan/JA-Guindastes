import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'
import { Group, type Object3D, Quaternion, type Scene, Vector3 } from 'three'

import { craneAttitude } from '../../domain/environment/craneAttitude'
import type { CranePlacement, TerrainSpec } from '../../domain/environment/environment'
import { CraneController, type CraneRig } from '../crane/CraneController'
import { createProvisionalCrane } from '../crane/createProvisionalCrane'
import { FICTITIOUS_MAX_LEVELING_DEG, OutriggerController } from '../crane/OutriggerController'
import { PROVISIONAL_CRANE_INITIAL_STATE } from '../crane/provisionalCraneSpec'
import { findOperatorEye } from '../crane/rigLandmarks'
import { SwitchableCrane } from '../crane/SwitchableCrane'
import type { CraneSetup } from '../crane/types'
import { TRUCK_CRANE_OUTRIGGER_TRAVEL_M } from '../loaders/loadTruckCraneModel'
import type { CraneModelSwap } from './buildCraneScene'
import { disposeObject3D } from './disposeObject3D'
import { enableShadows } from './enableShadows'
import { HookLoad } from './HookLoad'
import { SceneCollisions } from './SceneCollisions'
import { createCraneTagElement } from './sceneLabels'
import type { CraneModelTarget } from './upgradeCraneModel'

/** Prefixo do nome do grupo de cada guindaste adicional na cena (`extra-crane-<id>`). */
export const EXTRA_CRANE_NAME_PREFIX = 'extra-crane-'

/** Altura (m) da etiqueta do guindaste acima do chassi. */
const TAG_HEIGHT_M = 7

/**
 * Guindaste adicional da cena (TASK-074; ADR-037): um rig completo (o mesmo modelo 3D) com o próprio
 * controller, gancho, colisões e patolas, posicionado pelo cenário. Começa provisório e troca pelo
 * modelo 3D quando ele chega (`upgradeCraneModel`), como o guindaste principal. Só desenho e
 * pré-visualização: capacidade e segurança são do backend (RN-008).
 */
export class ExtraCrane implements CraneModelTarget {
  readonly id: string
  readonly label: string
  readonly setup: CraneSetup
  readonly anchor = new Group()
  readonly crane: SwitchableCrane
  readonly hookLoad: HookLoad
  readonly collisions: SceneCollisions
  readonly outriggers: OutriggerController

  private rig: CraneRig
  private root: Object3D
  private modelInUse = false
  private readonly tag: CSS2DObject
  private currentPlacement: CranePlacement

  constructor(init: {
    readonly id: string
    readonly label: string
    readonly setup: CraneSetup
    readonly scene: Scene
    readonly placement: CranePlacement
    readonly invalidate: () => void
    readonly reducedMotion: boolean
  }) {
    const { id, label, setup, scene, placement } = init
    this.id = id
    this.label = label
    this.setup = setup
    this.currentPlacement = placement
    this.rig = createProvisionalCrane(
      {
        boomRetractedLengthM: setup.limits.boomLengthM.min,
        boomExtendedLengthM: setup.limits.boomLengthM.max,
      },
      setup.geometryParameters,
    )
    this.root = this.rig.base
    enableShadows(this.rig.base)
    this.anchor.name = `${EXTRA_CRANE_NAME_PREFIX}${id}`
    this.anchor.add(this.rig.base)
    scene.add(this.anchor)
    const controller = new CraneController(
      this.rig,
      setup.limits,
      setup.geometryParameters,
      PROVISIONAL_CRANE_INITIAL_STATE,
    )
    this.crane = new SwitchableCrane(controller)
    this.hookLoad = new HookLoad(this.rig.hook)
    this.collisions = new SceneCollisions(this.rig, this.hookLoad, setup.geometryParameters)
    scene.add(this.collisions.highlight.root)

    // O guindaste adicional trabalha com as patolas estendidas e apoiadas.
    this.outriggers = new OutriggerController({
      getRoot: () => this.rig.base,
      invalidate: init.invalidate,
      beamTravelM: TRUCK_CRANE_OUTRIGGER_TRAVEL_M,
      reducedMotion: init.reducedMotion,
    })
    this.outriggers.setState({ extensionPercent: 100, jacksSet: true, levelingDeg: 0 })

    this.tag = new CSS2DObject(createCraneTagElement(label))
    this.tag.position.set(0, TAG_HEIGHT_M, 0)
    this.anchor.add(this.tag)
  }

  get rigInUse(): CraneRig {
    return this.rig
  }

  get usingModel(): boolean {
    return this.modelInUse
  }

  get placement(): CranePlacement {
    return this.currentPlacement
  }

  /** Olho do operador do rig em uso, ou `null`. */
  get operatorEye(): { x: number; y: number; z: number } | null {
    return findOperatorEye(this.rig)
  }

  /** Troca o provisório pelo modelo 3D, na mesma pose (como `CraneSceneContents.useModel`). */
  useModel(model: CraneModelSwap): void {
    if (this.modelInUse) throw new Error('O guindaste já usa o modelo 3D.')
    this.crane.switchTo(model.rig, model.afterCommand)
    enableShadows(model.root)
    this.anchor.add(model.root)
    this.hookLoad.attachTo(model.rig.hook)
    this.collisions.setRig(model.rig)
    const previous = this.root
    previous.removeFromParent()
    disposeObject3D(previous)
    this.rig = model.rig
    this.root = model.root
    this.modelInUse = true
    this.outriggers.reapply()
  }

  /** Assenta o guindaste no terreno e gira o chassi pelo rumo (como o principal). */
  setPlacement(terrain: TerrainSpec, placement: CranePlacement): void {
    this.currentPlacement = placement
    const attitude = craneAttitude(terrain, placement, FICTITIOUS_MAX_LEVELING_DEG)
    const yaw = new Quaternion().setFromAxisAngle(
      new Vector3(0, 1, 0),
      (placement.headingDeg * Math.PI) / 180,
    )
    const normal = new Vector3(attitude.normal.x, attitude.normal.y, attitude.normal.z)
    const tilt = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), normal)
    this.anchor.position.set(placement.x, attitude.groundY, placement.z)
    this.anchor.quaternion.copy(yaw.multiply(tilt))
  }

  dispose(): void {
    this.crane.setCollisionGuard(null)
    this.crane.setAppliedListener(null)
    this.tag.element.remove()
    this.tag.removeFromParent()
    this.collisions.dispose()
    this.hookLoad.dispose()
    this.anchor.removeFromParent()
    disposeObject3D(this.anchor)
  }
}
