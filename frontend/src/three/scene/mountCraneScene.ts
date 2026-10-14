import { NeutralToneMapping, PCFShadowMap, SRGBColorSpace, WebGLRenderer } from 'three'
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js'

import type { ScenarioSpec } from '../../domain/environment/environment'
import {
  CAMERA_TRANSITION_MS,
  type CameraPreset,
  type CameraView,
  resolveCameraPreset,
} from '../camera/cameraPresets'
import { CameraTransition } from '../camera/cameraTransition'
import { createCamera, INITIAL_CAMERA_TARGET, resizeCamera } from '../camera/createCamera'
import {
  applyCameraLimits,
  createOrbitControls,
  keepCameraAboveGround,
} from '../controls/createOrbitControls'
import type { OutriggerState } from '../../domain/crane/outriggers'
import { OutriggerController } from '../crane/OutriggerController'
import { TRUCK_CRANE_OUTRIGGER_TRAVEL_M } from '../loaders/loadTruckCraneModel'
import type { CraneCommands, CraneSetup, CraneState } from '../crane/types'
import type { CargoState, CargoStatus } from '../../domain/cargo/cargoOperation'
import {
  type CollisionState,
  collisionStateKey,
  NO_COLLISION,
} from '../../domain/collision/collisions'
import {
  AccessoryChain,
  type AccessoryModelLoader,
  type SceneAccessory,
} from '../accessories/AccessoryChain'
import { buildCraneScene } from './buildCraneScene'
import { disposeObject3D } from './disposeObject3D'
import type { LoadDimensions } from './loadBox'
import type { OperatingArea } from '../../domain/evaluation/operatingArea'
import type { SceneRotationZone } from './RotationZoneSectors'
import { type EvaluationStatus, normalizeEvaluationStatus, statusCssColor } from './palette'
import { type SceneEditorCallbacks, type SceneEditorConfig, SceneEditor } from './SceneEditor'
import { createScaleBar, pixelsPerMeter } from './scaleBar'
import { createRadiusLabel, createZoneLabelElement, paintZoneLabel } from './sceneLabels'
import {
  type CraneModelLoader,
  type CraneModelUpgradeResult,
  loadDefaultCraneModel,
  upgradeCraneModel,
} from './upgradeCraneModel'

/** Opções de `mountCraneScene`. */
export interface MountCraneSceneOptions {
  /**
   * Carregador do modelo 3D que substitui o guindaste provisório. Padrão: o GLB público
   * (`loadDefaultCraneModel`). `null`: fica no provisório.
   */
  readonly loadModel?: CraneModelLoader | null
  /** Avisado quando a troca termina, com o modelo em uso ou o motivo de ficar no provisório. */
  readonly onModelResult?: (result: CraneModelUpgradeResult) => void
  /**
   * Avisado quando o estado de colisão da carga muda (TASK-053; RN-012): carga atingindo o terreno, o
   * guindaste ou um obstáculo, comando bloqueado e cabo ou lança atravessando um obstáculo. É chamado
   * uma vez na montagem, com o estado sem colisão.
   */
  readonly onCollisionChange?: (state: CollisionState) => void
  /**
   * Avisado quando a situação da coleta e entrega muda (TASK-073; ADR-035): carga no chão ou no
   * gancho, se dá para engatar ou soltar, entrega feita. Chamado uma vez na montagem.
   */
  readonly onCargoChange?: (status: CargoStatus) => void
  /**
   * Carregador dos modelos 3D dos acessórios de içamento (TASK-056). Padrão: `loadGltf`. `null`:
   * os acessórios entram só no peso e na distância, sem malha.
   */
  readonly loadAccessoryModel?: AccessoryModelLoader | null
  /** Avisado quando o modelo de um acessório chega (`true`) ou não pôde ser carregado (`false`). */
  readonly onAccessoryModelResult?: (accessoryId: string, loaded: boolean) => void
}

/** Opções de `setCameraPreset`. */
export interface CameraPresetOptions {
  /** Transição suave (padrão). Com `prefers-reduced-motion: reduce`, a troca é sempre imediata. */
  readonly animate?: boolean
}

/** O que a UI recebe da cena montada: comandos e ajustes visuais, sem objetos Three.js. */
export interface CraneSceneHandle {
  readonly crane: CraneCommands
  /** Cor do anel e do halo pela situação (TASK-041). A cena não decide a situação (RN-008). */
  setEvaluationStatus(status: EvaluationStatus): void
  /** Caixa da carga pendurada no gancho; `null` (ou medidas inválidas) deixa só o gancho. */
  setLoad(load: LoadDimensions | null): void
  /**
   * Setores das zonas de giro no chão (TASK-046), com um rótulo curto por zona. Lista vazia apaga.
   * Só conferência visual: a zona que vale é a do backend (RN-008).
   */
  setRotationZones(zones: readonly SceneRotationZone[]): void
  /** Destaca o setor da zona atual (`null` = nenhum). A UI decide qual é (resultado ou prévia por ψ). */
  setActiveRotationZone(code: string | null): void
  /**
   * Área de operação verde, amarela e vermelha no chão (TASK-055; ADR-025). `null` apaga. Só
   * desenho: o nível de cada célula vem do backend (RN-008).
   */
  setOperatingArea(area: OperatingArea | null): void
  /**
   * Cadeia de acessórios de içamento entre o gancho e a carga (TASK-056; RN-014), na ordem do gancho
   * para a carga. A carga desce a soma de `riggingHeightM`. Lista vazia remove. Só desenho.
   */
  setAccessories(accessories: readonly SceneAccessory[]): void
  /**
   * Cenário (TASK-052; ADR-023): terreno deslocado por `terrainHeightAt`, obstáculos e posição do
   * guindaste. `null` volta ao plano e ao guindaste na origem. A predefinição de câmera seguida
   * acompanha o guindaste.
   */
  setScenario(scenario: ScenarioSpec | null): void
  /** Leva a câmera a uma predefinição, enquadrando o estado atual do guindaste. */
  setCameraPreset(preset: CameraPreset, options?: CameraPresetOptions): void
  /**
   * Dados do cenário (terreno, obstáculos e posição do guindaste) usados só para colidir (TASK-053;
   * ADR-028); quem desenha é a TASK-052. Sem chamar, vale o cenário vazio: chão plano em y = 0 e o
   * guindaste na origem. Reavalia o estado atual.
   */
  setEnvironment(spec: ScenarioSpec): void
  /** Último estado de colisão (o mesmo que `onCollisionChange` recebeu). */
  getCollisionState(): CollisionState
  /**
   * Engata a carga que está no chão se o gancho estiver a até 0,5 m acima do topo e alinhado a até
   * 0,5 m (TASK-073). Devolve se engatou.
   */
  engageCargo(): boolean
  /**
   * Solta a carga engatada se a base dela estiver a até 0,2 m do chão; dentro do raio do ponto de
   * entrega, marca a entrega (TASK-073). Devolve se soltou.
   */
  releaseCargo(): boolean
  /** Mostra o estado da carga de uma gravação em reprodução; `null` volta ao estado ao vivo. */
  setCargoPlayback(state: CargoState | null): void
  /** Última situação da coleta e entrega. */
  getCargoStatus(): CargoStatus
  /**
   * Patolas (TASK-054): estende as vigas, desce os macacos e nivela, animado. Só move os nós
   * `crane-outrigger-*` que o modelo 3D tiver; sem eles, não desenha nada.
   */
  setOutriggers(state: OutriggerState): void
  /**
   * Editor 3D do ambiente (TASK-066; ADR-032): liga as ferramentas de arrasto, pincel e pintura na
   * cena. `null` desliga. A cena só devolve as mudanças por `callbacks`; o cenário fica na UI.
   */
  setEditor(editor: { config: SceneEditorConfig; callbacks: SceneEditorCallbacks } | null): void
  /** Para o laço de renderização e libera renderer, controles, geometrias e materiais. Idempotente. */
  dispose(): void
}

function sameCraneState(a: CraneState, b: CraneState): boolean {
  return (
    a.turretRotationDeg === b.turretRotationDeg &&
    a.boomAngleDeg === b.boomAngleDeg &&
    a.boomLengthM === b.boomLengthM &&
    a.cableLengthM === b.cableLengthM
  )
}

/** `true` se a pessoa pediu menos movimento ao sistema (`prefers-reduced-motion: reduce`). */
function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/**
 * Cria o renderer WebGL dentro de `container` (que deve ter tamanho definido pelo layout) e começa a
 * desenhar a cena do guindaste provisório, com os limites e os parâmetros a e h de `setup` (sem ele,
 * os FICTÍCIOS da PoC; TASK-033). Lança erro se o navegador não oferecer WebGL.
 *
 * A renderização pausa com a aba oculta e volta quando ela aparece (TASK-041, CA-6).
 *
 * Em seguida baixa o modelo 3D ilustrativo (`options.loadModel`, por padrão o GLB público) e troca o
 * guindaste provisório por ele quando chega, na mesma pose e com os mesmos comandos; se falhar, a cena
 * fica no provisório com aviso no console. `loadModel: null` desliga o carregamento.
 */
export function mountCraneScene(
  container: HTMLElement,
  setup?: CraneSetup,
  options: MountCraneSceneOptions = {},
): CraneSceneHandle {
  const contents = buildCraneScene(setup)
  const {
    scene,
    crane,
    environment,
    radiusIndicator,
    hookLoad,
    rotationZones,
    collisions,
    operatingArea,
    cargo,
  } = contents

  const renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  // Neutral: preserva as cores da paleta e o branco do papel, sem o amarelado e o contraste do ACES.
  renderer.toneMapping = NeutralToneMapping
  renderer.toneMappingExposure = 1
  renderer.outputColorSpace = SRGBColorSpace
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = PCFShadowMap
  renderer.domElement.style.display = 'block'
  renderer.domElement.style.width = '100%'
  renderer.domElement.style.height = '100%'
  container.appendChild(renderer.domElement)

  // Camada HTML dos rótulos, por cima do canvas e sem capturar o mouse.
  const restoreContainerPosition = container.style.position
  if (window.getComputedStyle(container).position === 'static') {
    container.style.position = 'relative'
  }
  const labelRenderer = new CSS2DRenderer()
  Object.assign(labelRenderer.domElement.style, {
    position: 'absolute',
    inset: '0',
    pointerEvents: 'none',
    overflow: 'hidden',
  })
  container.appendChild(labelRenderer.domElement)
  const radiusLabel = createRadiusLabel()
  const labelElement = radiusLabel.element
  radiusLabel.text.textContent = radiusIndicator.labelText
  const label = new CSS2DObject(labelElement)
  // A ponta da linha de chamada (canto de baixo à esquerda) fica sobre a âncora.
  label.center.set(0, 1)
  radiusIndicator.labelAnchor.add(label)

  // Rótulos das zonas de giro (TASK-046), refeitos quando as zonas mudam.
  let zoneLabels: { code: string; element: HTMLDivElement; object: CSS2DObject }[] = []
  const removeZoneLabels = (): void => {
    for (const zoneLabel of zoneLabels) {
      zoneLabel.object.removeFromParent()
      zoneLabel.element.remove()
    }
    zoneLabels = []
  }

  // Escala gráfica no canto do quadro (TASK-047), na distância do alvo da órbita.
  const scaleBar = createScaleBar()
  container.appendChild(scaleBar.element)

  const camera = createCamera(1)
  const controls = createOrbitControls(camera, renderer.domElement, INITIAL_CAMERA_TARGET)

  let transition: CameraTransition | null = null
  /**
   * Predefinição que a câmera ainda segue: enquanto a pessoa não mexe na órbita, uma mudança de
   * tamanho do quadro refaz o enquadramento para a proporção nova (TASK-047). Começa na perspectiva.
   */
  let followedPreset: CameraPreset | null = 'perspectiva'
  // Arrastar (ou dar zoom) interrompe a transição em curso e solta a predefinição.
  const cancelTransition = (): void => {
    transition = null
    followedPreset = null
  }
  controls.addEventListener('start', cancelTransition)

  const applyView = (view: CameraView): void => {
    camera.position.set(view.position.x, view.position.y, view.position.z)
    controls.target.set(view.target.x, view.target.y, view.target.z)
  }

  /** Enquadramento da predefinição para o estado atual do guindaste e a proporção do quadro. */
  const presetView = (preset: CameraPreset): CameraView => {
    const view = resolveCameraPreset(preset, {
      turretRotationDeg: crane.getState().turretRotationDeg,
      geometry: crane.getOperationalGeometry(),
      maxReachM: radiusIndicator.reach.maxM,
      operatorEye: contents.operatorEye ?? undefined,
      aspect: camera.aspect,
      fovDeg: camera.fov,
    })
    // As predefinições enquadram o guindaste na origem; com o cenário, o conjunto se desloca com ele
    // (só a posição: o rumo do chassi não gira a câmera).
    const { x, y, z } = contents.craneAnchor.position
    if (x === 0 && y === 0 && z === 0) return view
    const shift = (v: { x: number; y: number; z: number }) => ({
      x: v.x + x,
      y: v.y + y,
      z: v.z + z,
    })
    return { position: shift(view.position), target: shift(view.target) }
  }

  const jumpTo = (view: CameraView): void => {
    transition = null
    applyView(view)
    applyCameraLimits(controls)
    controls.update()
  }

  // Renderização sob demanda (CA-6): o laço roda a cada quadro, mas só desenha quando algo mudou
  // (câmera, guindaste, ajustes visuais, tamanho, troca de modelo). Parado, não gasta GPU.
  let dirty = true
  const invalidate = (): void => {
    dirty = true
  }

  // Objetos da biblioteca (TASK-072): quando um GLB termina de carregar, pede um quadro novo.
  contents.obstacles.setOnChange(invalidate)

  const accessoryChain = new AccessoryChain({
    loader: options.loadAccessoryModel,
    onModelResult: options.onAccessoryModelResult,
    onChange: invalidate,
  })

  const resize = (): void => {
    const width = container.clientWidth
    const height = container.clientHeight
    if (width <= 0 || height <= 0) return
    // `false`: o CSS acima já estica o canvas; aqui só muda a resolução do desenho.
    renderer.setSize(width, height, false)
    labelRenderer.setSize(width, height)
    resizeCamera(camera, width, height)
    // Quadro mais estreito ou mais alto: a predefinição seguida se reenquadra, sem cortar a lança.
    if (followedPreset && !transition) jumpTo(presetView(followedPreset))
    invalidate()
  }
  resize()
  // Vista inicial: a perspectiva enquadrada para o quadro (mesmo antes de ele ter tamanho).
  if (followedPreset) jumpTo(presetView(followedPreset))
  const resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(container)

  let lastState: CraneState | null = null
  /** Atualiza o anel e o rótulo; devolve `true` se o estado do guindaste mudou desde o último quadro. */
  const syncWithCrane = (): boolean => {
    const state = crane.getState()
    if (lastState && sameCraneState(state, lastState)) return false
    lastState = state
    const changed = radiusIndicator.update({
      workingRadiusM: crane.getOperationalGeometry().workingRadiusM,
      turretRotationDeg: state.turretRotationDeg,
    })
    if (changed) radiusLabel.text.textContent = radiusIndicator.labelText
    return true
  }

  // Patolas (TASK-054): a animação avança a cada quadro e invalida só enquanto algo se move.
  const outriggers = new OutriggerController({
    getRoot: () => contents.rig.base,
    invalidate,
    beamTravelM: TRUCK_CRANE_OUTRIGGER_TRAVEL_M,
    reducedMotion: prefersReducedMotion(),
  })

  const renderFrame = (): void => {
    const outriggersMoved = outriggers.update(performance.now())
    const craneChanged = syncWithCrane() || outriggersMoved
    const moving = transition !== null
    if (transition) {
      const { view, done } = transition.sample(performance.now())
      applyView(view)
      if (done) transition = null
    }
    applyCameraLimits(controls)
    const cameraChanged = controls.update()
    const lifted = keepCameraAboveGround(controls)
    if (!(dirty || craneChanged || moving || cameraChanged || lifted)) return
    dirty = false
    const targetDistance = camera.position.distanceTo(controls.target)
    environment.update(camera.position, targetDistance)
    scaleBar.update(pixelsPerMeter(targetDistance, camera.fov, container.clientHeight))
    renderer.render(scene, camera)
    labelRenderer.render(scene, camera)
  }

  let disposed = false
  // Aba oculta: nada de quadros (o navegador já freia o rAF, mas aqui o laço para de vez).
  const onVisibilityChange = (): void => {
    if (disposed) return
    invalidate()
    renderer.setAnimationLoop(document.hidden ? null : renderFrame)
  }
  document.addEventListener('visibilitychange', onVisibilityChange)
  if (!document.hidden) renderer.setAnimationLoop(renderFrame)

  // Colisões (TASK-053): a guarda corta comandos que levariam a carga a colidir e avisa a UI.
  let collisionKey = collisionStateKey(NO_COLLISION)
  collisions.setListener((state) => {
    invalidate()
    // O guindaste se moveu (ou algo mudou): reavalia se dá para engatar e soltar.
    cargo.refresh()
    const key = collisionStateKey(state)
    if (key === collisionKey) return
    collisionKey = key
    options.onCollisionChange?.(state)
  })
  crane.setCollisionGuard(collisions)
  options.onCollisionChange?.(collisions.state)
  cargo.setListener((status) => {
    invalidate()
    options.onCargoChange?.(status)
  })

  // Modelo 3D: carrega em segundo plano; enquanto isso, o provisório fica na cena.
  const modelAbort = new AbortController()
  const loadModel = options.loadModel === undefined ? loadDefaultCraneModel : options.loadModel
  if (loadModel) {
    void upgradeCraneModel(contents, loadModel, { signal: modelAbort.signal }).then((result) => {
      outriggers.reapply()
      invalidate()
      crane.revalidate()
      options.onModelResult?.(result)
    })
  }

  let editor: SceneEditor | null = null

  const handle: CraneSceneHandle = {
    crane,
    setEvaluationStatus(status) {
      const normalized = normalizeEvaluationStatus(status)
      radiusIndicator.setStatus(normalized)
      hookLoad.setStatus(normalized)
      radiusLabel.paint(statusCssColor(normalized))
      invalidate()
    },
    setLoad(load) {
      // Com carga posicionada, ela fica no chão até engatar; sem, pende do gancho (TASK-073).
      cargo.setLoad(load)
      crane.revalidate()
      invalidate()
    },
    setAccessories(accessories) {
      if (disposed || !accessoryChain.setAccessories(accessories)) return
      hookLoad.setAccessories(
        accessoryChain.root,
        accessoryChain.totalDropM,
        accessoryChain.replacesHook,
      )
      invalidate()
    },
    setRotationZones(zones) {
      if (disposed || !rotationZones.setZones(zones)) return
      removeZoneLabels()
      for (const { code, name, anchor } of rotationZones.labelAnchors) {
        const element = createZoneLabelElement(code, name)
        paintZoneLabel(element, code === rotationZones.activeCode)
        const object = new CSS2DObject(element)
        anchor.add(object)
        zoneLabels.push({ code, element, object })
      }
      invalidate()
    },
    setActiveRotationZone(code) {
      if (disposed || !rotationZones.setActive(code)) return
      for (const zoneLabel of zoneLabels) paintZoneLabel(zoneLabel.element, zoneLabel.code === code)
      invalidate()
    },
    setOperatingArea(area) {
      if (disposed || !operatingArea.setArea(area)) return
      invalidate()
    },
    setScenario(scenario) {
      if (disposed) return
      contents.setScenario(scenario)
      editor?.refresh()
      if (followedPreset && !transition) jumpTo(presetView(followedPreset))
      invalidate()
    },
    setCameraPreset(preset, options = {}) {
      if (disposed) return
      const to = presetView(preset)
      const animate = (options.animate ?? true) && !prefersReducedMotion()
      if (!animate) {
        jumpTo(to)
        followedPreset = preset
        invalidate()
        return
      }
      const from: CameraView = {
        position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
        target: { x: controls.target.x, y: controls.target.y, z: controls.target.z },
      }
      transition = new CameraTransition(from, to, CAMERA_TRANSITION_MS, performance.now())
      followedPreset = preset
    },
    setEnvironment(spec) {
      if (disposed) return
      collisions.setScenario(spec)
      crane.revalidate()
      invalidate()
    },
    getCollisionState() {
      return collisions.state
    },
    engageCargo() {
      if (disposed) return false
      const done = cargo.engage(performance.now())
      invalidate()
      return done
    },
    releaseCargo() {
      if (disposed) return false
      const done = cargo.release(performance.now())
      invalidate()
      return done
    },
    setCargoPlayback(state) {
      if (disposed) return
      cargo.setPlayback(state)
      invalidate()
    },
    getCargoStatus() {
      return cargo.status
    },
    setOutriggers(state) {
      if (disposed) return
      outriggers.setState(state)
      // Com os macacos apoiados, a inclinação do terreno até a correção deles some do modelo.
      contents.setLevelingDeg(
        state.jacksSet ? Math.min(Math.max(0, state.levelingDeg), outriggers.maxLevelingDeg) : 0,
      )
      editor?.refresh()
      invalidate()
    },
    setEditor(next) {
      if (disposed) return
      // Editando, a câmera não volta sozinha ao enquadramento da predefinição.
      if (next) followedPreset = null
      if (!next) {
        editor?.dispose()
        editor = null
        invalidate()
        return
      }
      // Ao entrar na edição, a carga volta à posição escolhida (a gravação fica no ambiente salvo).
      if (!editor) cargo.reset()
      editor ??= new SceneEditor({
        scene,
        camera,
        domElement: renderer.domElement,
        container,
        controls,
        contents,
        invalidate,
      })
      editor.configure(next.config, next.callbacks)
    },
    dispose() {
      if (disposed) return
      disposed = true
      // Um GLB que chegue depois é liberado por `upgradeCraneModel` sem entrar na cena.
      modelAbort.abort()
      renderer.setAnimationLoop(null)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      resizeObserver.disconnect()
      editor?.dispose()
      editor = null
      controls.removeEventListener('start', cancelTransition)
      controls.dispose()
      label.removeFromParent()
      labelElement.remove()
      removeZoneLabels()
      rotationZones.dispose()
      operatingArea.dispose()
      contents.obstacles.dispose()
      labelRenderer.domElement.remove()
      scaleBar.element.remove()
      crane.setCollisionGuard(null)
      collisions.dispose()
      hookLoad.dispose()
      cargo.dispose()
      disposeObject3D(scene)
      accessoryChain.dispose()
      renderer.dispose()
      // Libera o contexto WebGL já, sem esperar o coletor de lixo: o navegador limita quantos
      // contextos podem existir (o StrictMode do React monta e desmonta a cena duas vezes em dev).
      renderer.forceContextLoss()
      renderer.domElement.remove()
      container.style.position = restoreContainerPosition
    },
  }
  handle.setEvaluationStatus('unknown')
  return handle
}
