import { ACESFilmicToneMapping, PCFShadowMap, SRGBColorSpace, WebGLRenderer } from 'three'
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js'

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
import type { CraneCommands, CraneSetup } from '../crane/types'
import { buildCraneScene } from './buildCraneScene'
import { disposeObject3D } from './disposeObject3D'
import type { LoadDimensions } from './loadBox'
import {
  type EvaluationStatus,
  normalizeEvaluationStatus,
  SCENE_COLORS,
  statusCssColor,
  toCssHex,
} from './palette'

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
  /** Leva a câmera a uma predefinição, enquadrando o estado atual do guindaste. */
  setCameraPreset(preset: CameraPreset, options?: CameraPresetOptions): void
  /** Para o laço de renderização e libera renderer, controles, geometrias e materiais. Idempotente. */
  dispose(): void
}

/** `true` se a pessoa pediu menos movimento ao sistema (`prefers-reduced-motion: reduce`). */
function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/** Rótulo HTML do raio (CSS2D): nítido em qualquer zoom, legível sobre o chão escuro. */
function createRadiusLabelElement(): HTMLDivElement {
  const element = document.createElement('div')
  element.className = 'crane-viewport__radius-label'
  element.dataset.sceneLabel = 'working-radius'
  // O mesmo valor está no painel de geometria; aqui é só apoio visual.
  element.setAttribute('aria-hidden', 'true')
  Object.assign(element.style, {
    font: "600 12px/1.2 'JetBrains Mono Variable', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    fontVariantNumeric: 'tabular-nums',
    letterSpacing: '0.02em',
    color: toCssHex(SCENE_COLORS.labelText),
    background: 'rgba(11, 15, 21, 0.82)',
    border: '1px solid',
    borderLeftWidth: '3px',
    borderRadius: '4px',
    padding: '3px 8px',
    whiteSpace: 'nowrap',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.35)',
    pointerEvents: 'none',
    userSelect: 'none',
  } satisfies Partial<CSSStyleDeclaration>)
  return element
}

/**
 * Cria o renderer WebGL dentro de `container` (que deve ter tamanho definido pelo layout) e começa a
 * desenhar a cena do guindaste provisório, com os limites e os parâmetros a e h de `setup` (sem ele,
 * os FICTÍCIOS da PoC; TASK-033). Lança erro se o navegador não oferecer WebGL.
 *
 * A renderização pausa com a aba oculta e volta quando ela aparece (TASK-041, CA-6).
 */
export function mountCraneScene(container: HTMLElement, setup?: CraneSetup): CraneSceneHandle {
  const { scene, crane, environment, radiusIndicator, hookLoad } = buildCraneScene(setup)

  const renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.toneMapping = ACESFilmicToneMapping
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
  const labelElement = createRadiusLabelElement()
  labelElement.textContent = radiusIndicator.labelText
  const label = new CSS2DObject(labelElement)
  radiusIndicator.labelAnchor.add(label)

  const camera = createCamera(1)
  const controls = createOrbitControls(camera, renderer.domElement, INITIAL_CAMERA_TARGET)

  let transition: CameraTransition | null = null
  // Arrastar a câmera interrompe a transição em curso.
  const cancelTransition = (): void => {
    transition = null
  }
  controls.addEventListener('start', cancelTransition)

  const applyView = (view: CameraView): void => {
    camera.position.set(view.position.x, view.position.y, view.position.z)
    controls.target.set(view.target.x, view.target.y, view.target.z)
  }

  const resize = (): void => {
    const width = container.clientWidth
    const height = container.clientHeight
    if (width <= 0 || height <= 0) return
    // `false`: o CSS acima já estica o canvas; aqui só muda a resolução do desenho.
    renderer.setSize(width, height, false)
    labelRenderer.setSize(width, height)
    resizeCamera(camera, width, height)
  }
  resize()
  const resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(container)

  const syncWithCrane = (): void => {
    const changed = radiusIndicator.update({
      workingRadiusM: crane.getOperationalGeometry().workingRadiusM,
      turretRotationDeg: crane.getState().turretRotationDeg,
    })
    if (changed) labelElement.textContent = radiusIndicator.labelText
  }

  const renderFrame = (): void => {
    syncWithCrane()
    if (transition) {
      const { view, done } = transition.sample(performance.now())
      applyView(view)
      if (done) transition = null
    }
    applyCameraLimits(controls)
    controls.update()
    keepCameraAboveGround(controls)
    environment.update(camera.position, camera.position.distanceTo(controls.target))
    renderer.render(scene, camera)
    labelRenderer.render(scene, camera)
  }

  let disposed = false
  // Aba oculta: nada de quadros (o navegador já freia o rAF, mas aqui o laço para de vez).
  const onVisibilityChange = (): void => {
    if (disposed) return
    renderer.setAnimationLoop(document.hidden ? null : renderFrame)
  }
  document.addEventListener('visibilitychange', onVisibilityChange)
  if (!document.hidden) renderer.setAnimationLoop(renderFrame)

  const handle: CraneSceneHandle = {
    crane,
    setEvaluationStatus(status) {
      const normalized = normalizeEvaluationStatus(status)
      radiusIndicator.setStatus(normalized)
      hookLoad.setStatus(normalized)
      labelElement.style.borderColor = statusCssColor(normalized)
    },
    setLoad(load) {
      hookLoad.setLoad(load)
    },
    setCameraPreset(preset, options = {}) {
      if (disposed) return
      const to = resolveCameraPreset(preset, {
        turretRotationDeg: crane.getState().turretRotationDeg,
        geometry: crane.getOperationalGeometry(),
        maxReachM: radiusIndicator.reach.maxM,
      })
      const animate = (options.animate ?? true) && !prefersReducedMotion()
      if (!animate) {
        transition = null
        applyView(to)
        applyCameraLimits(controls)
        controls.update()
        return
      }
      const from: CameraView = {
        position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
        target: { x: controls.target.x, y: controls.target.y, z: controls.target.z },
      }
      transition = new CameraTransition(from, to, CAMERA_TRANSITION_MS, performance.now())
    },
    dispose() {
      if (disposed) return
      disposed = true
      renderer.setAnimationLoop(null)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      resizeObserver.disconnect()
      controls.removeEventListener('start', cancelTransition)
      controls.dispose()
      label.removeFromParent()
      labelElement.remove()
      labelRenderer.domElement.remove()
      hookLoad.dispose()
      disposeObject3D(scene)
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
