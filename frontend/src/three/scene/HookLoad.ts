import {
  BoxGeometry,
  BufferGeometry,
  Color,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
} from 'three'

import { measureHookExtent } from '../crane/rigLandmarks'
import { cargoModelId, cargoModelInstance, cargoModels, loadCargoModel } from './CargoModels'
import {
  computeLoadBox,
  HOOK_ATTACH_OFFSET_M,
  type HookedCargoPose,
  type LoadBoxLayout,
  type LoadDimensions,
  sameHookedPose,
  sameLoad,
} from './loadBox'
import { type EvaluationStatus, SCENE_COLORS, STATUS_COLORS, statusColor } from './palette'

// Carga pendurada no gancho e halo de situação (TASK-041). Só desenho: não entra em nenhum cálculo.
// O grupo é filho do nó do gancho (origem em G), então acompanha o cabo sem tocar na cinemática.
// O ponto das lingas e o tamanho do halo saem da caixa das malhas do gancho em uso (provisório ou
// GLB), medida em `fitToHook`; sem malhas, valem as constantes do gancho provisório.

export const HOOK_LOAD_NAMES = {
  root: 'hook-load',
  box: 'hook-load-box',
  edges: 'hook-load-edges',
  slings: 'hook-load-slings',
  halo: 'hook-load-halo',
  /** Modelo 3D do tipo de carga, no lugar da caixa (leva F). */
  model: 'hook-load-model',
} as const

/** Halo sem carga e sem medida do gancho: esfera em volta do gancho provisório (m, locais de G). */
const HOOK_HALO_CENTER_Y = -0.55
const HOOK_HALO_RADIUS_M = 0.95
/** Folga do halo em volta do gancho medido: proporção das meias-medidas mais uma margem (m). */
const HOOK_HALO_SCALE = 1.3
const HOOK_HALO_MARGIN_M = 0.15
/** Quanto o halo passa das bordas da carga, em proporção das meias-medidas. */
const LOAD_HALO_SCALE = 1.25
/** Com o moitão do modelo escondido, a cadeia parte do fim do cabo (G); 1 cm evita o valor padrão. */
const REPLACED_HOOK_ATTACH_M = 0.01
/** Opacidade máxima do contorno na silhueta: sutil, sem neon. */
export const HALO_INTENSITY = 0.35
/** Sem situação (`unknown`), o halo cinza fica ainda mais discreto: não há nada a destacar. */
export const HALO_INTENSITY_UNKNOWN = 0.15

// Contorno de situação (fresnel), em mistura normal sobre o papel: transparente de frente e só um traço
// translúcido na silhueta, sem brilho aditivo nem neon (ADR-019).
const HALO_VERTEX = /* glsl */ `
varying vec3 vNormal;
varying vec3 vViewDirection;
void main() {
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vNormal = normalize(normalMatrix * normal);
  vViewDirection = normalize(-mvPosition.xyz);
  gl_Position = projectionMatrix * mvPosition;
}
`

const HALO_FRAGMENT = /* glsl */ `
uniform vec3 color;
uniform float intensity;
varying vec3 vNormal;
varying vec3 vViewDirection;
void main() {
  float rim = 1.0 - abs(dot(normalize(vNormal), normalize(vViewDirection)));
  float alpha = pow(rim, 3.0) * intensity;
  gl_FragColor = vec4(color, alpha);
  #include <colorspace_fragment>
}
`

export class HookLoad {
  readonly root = new Group()

  private readonly halo: Mesh<SphereGeometry, ShaderMaterial>
  private readonly boxMaterial = new MeshStandardMaterial({
    color: SCENE_COLORS.load,
    roughness: 0.9,
    metalness: 0,
  })
  private readonly edgesMaterial = new LineBasicMaterial({
    color: SCENE_COLORS.loadEdges,
    transparent: true,
    opacity: 0.85,
    toneMapped: false,
  })
  private readonly slingMaterial = new LineBasicMaterial({
    color: SCENE_COLORS.sling,
    toneMapped: false,
  })
  private highlighted = false
  private loadParts: Object3D[] = []
  /** Caixa e arestas da carga e o modelo 3D do tipo (leva F), quando já chegou; ele toma o lugar da caixa. */
  private boxMesh: Mesh | null = null
  private edgesLines: LineSegments | null = null
  private cargoModel: Object3D | null = null
  private onModelReady: (() => void) | null = null
  private load: LoadDimensions | null = null
  /** Posição da carga em relação ao gancho depois de engatada (TASK-073); `null` = centrada nele. */
  private hookedPose: HookedCargoPose | null = null
  private layout: LoadBoxLayout | null = null
  private hook: Object3D
  private attachOffsetM = HOOK_ATTACH_OFFSET_M
  /** Raiz da cadeia de acessórios (TASK-056) e a soma de `rigging_height_m` que ela ocupa (m). */
  private accessoriesRoot: Object3D | null = null
  private accessoriesDropM = 0
  /** `true` com um moitão na cadeia: o moitão do modelo some e o do acessório toma o lugar dele. */
  private hookReplaced = false
  /** Caixa do gancho (centro e meias-medidas, locais de G), ou `null` sem malhas. */
  private hookExtent: { readonly center: Vector3; readonly half: Vector3 } | null = null

  constructor(hook: Object3D) {
    this.hook = hook
    this.root.name = HOOK_LOAD_NAMES.root
    this.halo = new Mesh(
      new SphereGeometry(1, 32, 16),
      new ShaderMaterial({
        name: HOOK_LOAD_NAMES.halo,
        uniforms: {
          color: { value: new Color(statusColor('unknown')) },
          intensity: { value: HALO_INTENSITY_UNKNOWN },
        },
        vertexShader: HALO_VERTEX,
        fragmentShader: HALO_FRAGMENT,
        transparent: true,
        depthWrite: false,
      }),
    )
    this.halo.name = HOOK_LOAD_NAMES.halo
    this.halo.renderOrder = 4
    this.root.add(this.halo)
    hook.add(this.root)
    this.fitToHook()
  }

  /** Caixa desenhada agora, ou `null` quando só há o gancho. */
  get currentLayout(): LoadBoxLayout | null {
    return this.layout
  }

  /** Distância (m) de G até onde as lingas se prendem, na base do gancho em uso. */
  get currentAttachOffsetM(): number {
    return this.attachOffsetM
  }

  get haloColor(): Color {
    return this.halo.material.uniforms.color.value as Color
  }

  /** Intensidade atual do contorno do halo. */
  get haloIntensity(): number {
    return this.halo.material.uniforms.intensity.value as number
  }

  /** Mostra a caixa da carga pendurada pelas lingas, ou só o gancho com `null` ou medidas inválidas. */
  setLoad(load: LoadDimensions | null | undefined, hooked: HookedCargoPose | null = null): void {
    if (sameLoad(load, this.load) && sameHookedPose(hooked, this.hookedPose)) return
    this.hookedPose = hooked
    this.rebuild(load)
  }

  /** Caixa do gancho em uso (centro e meias-medidas, locais de G), ou `null` sem malhas medidas. */
  get currentHookBox(): {
    readonly center: { x: number; y: number; z: number }
    readonly half: { x: number; y: number; z: number }
  } | null {
    const extent = this.hookExtent
    if (!extent) return null
    return {
      center: { x: extent.center.x, y: extent.center.y, z: extent.center.z },
      half: { x: extent.half.x, y: extent.half.y, z: extent.half.z },
    }
  }

  /** `true` enquanto a carga está destacada em vermelho por uma colisão (TASK-053). */
  get collisionHighlighted(): boolean {
    return this.highlighted
  }

  /** Destaque vermelho da carga atingida (RN-012); `false` volta às cores normais. */
  setCollisionHighlight(on: boolean): void {
    if (on === this.highlighted) return
    this.highlighted = on
    this.boxMaterial.color.setHex(on ? STATUS_COLORS.over : SCENE_COLORS.load)
    this.edgesMaterial.color.setHex(on ? STATUS_COLORS.over : SCENE_COLORS.loadEdges)
    this.syncCargoModelVisibility()
  }

  /** `true` quando o modelo 3D do tipo de carga está aparecendo no lugar da caixa. */
  get showsCargoModel(): boolean {
    return this.cargoModel !== null && this.cargoModel.visible
  }

  /** Quanto a carga desce abaixo do gancho pela cadeia de acessórios (m; TASK-056). */
  get currentAccessoriesDropM(): number {
    return this.accessoriesDropM
  }

  /**
   * Cadeia de acessórios entre o gancho e a carga (TASK-056; RN-014): `root` fica preso ao ponto de
   * amarração do gancho, e a carga desce `dropM` (a soma de `rigging_height_m`). Só desenho. `null`
   * (ou `dropM` inválido) volta a carga ao ponto de antes. Com `replacesHook`, o moitão do próprio
   * modelo fica escondido e a cadeia parte do fim do cabo, para não haver dois moitões.
   */
  setAccessories(root: Object3D | null, dropM: number, replacesHook = false): void {
    const drop = Number.isFinite(dropM) && dropM > 0 ? dropM : 0
    const replaced = root !== null && replacesHook
    if (
      root === this.accessoriesRoot &&
      drop === this.accessoriesDropM &&
      replaced === this.hookReplaced
    )
      return
    this.hookReplaced = replaced
    if (this.accessoriesRoot && this.accessoriesRoot !== root)
      this.accessoriesRoot.removeFromParent()
    this.accessoriesRoot = root
    this.accessoriesDropM = root ? drop : 0
    this.rebuild(this.load)
  }

  /** Cor do halo pela situação. */
  setStatus(status: EvaluationStatus): void {
    this.haloColor.setHex(statusColor(status))
    this.halo.material.uniforms.intensity.value =
      status === 'unknown' ? HALO_INTENSITY_UNKNOWN : HALO_INTENSITY
  }

  /**
   * Pendura o grupo (halo e carga) em outro gancho, como na troca do guindaste provisório pelo GLB:
   * a carga e a situação continuam, e o gancho novo é medido.
   */
  attachTo(hook: Object3D): void {
    this.showBuiltInHook(true)
    this.hook = hook
    hook.add(this.root)
    this.fitToHook()
  }

  /** Mede o gancho atual (sem o próprio grupo) e refaz a carga e o halo com essa medida. */
  fitToHook(): void {
    const box = measureHookExtent(this.hook, [this.root])
    if (box && box.min.y < 0) {
      this.attachOffsetM = -box.min.y
      this.hookExtent = {
        center: box.getCenter(new Vector3()),
        half: box.getSize(new Vector3()).multiplyScalar(0.5),
      }
    } else {
      this.attachOffsetM = HOOK_ATTACH_OFFSET_M
      this.hookExtent = null
    }
    this.rebuild(this.load)
  }

  /** Libera o que foi criado aqui (o `disposeObject3D` da cena também cobre, uma vez só). */
  dispose(): void {
    this.clearLoad()
    this.halo.geometry.dispose()
    this.halo.material.dispose()
    this.boxMaterial.dispose()
    this.edgesMaterial.dispose()
    this.slingMaterial.dispose()
    this.root.removeFromParent()
  }

  private rebuild(load: LoadDimensions | null | undefined): void {
    this.clearLoad()
    this.showBuiltInHook(!this.hookReplaced)
    const attach = this.hookReplaced ? REPLACED_HOOK_ATTACH_M : this.attachOffsetM
    this.layout = computeLoadBox(load, attach, this.accessoriesDropM, this.hookedPose)
    if (this.accessoriesRoot) {
      this.accessoriesRoot.position.set(0, -attach, 0)
      if (this.accessoriesRoot.parent !== this.root) this.root.add(this.accessoriesRoot)
    }
    this.load = this.layout && load ? { ...load } : null
    if (this.layout) this.buildLoad(this.layout)
    this.fitHalo()
  }

  /** Mostra ou esconde as malhas do moitão do modelo (tudo no nó do gancho, menos este grupo). */
  private showBuiltInHook(visible: boolean): void {
    for (const child of this.hook.children) {
      if (child !== this.root) child.visible = visible
    }
  }

  private buildLoad(layout: LoadBoxLayout): void {
    const boxGeometry = new BoxGeometry(layout.size.x, layout.size.y, layout.size.z)
    const box = new Mesh(boxGeometry, this.boxMaterial)
    box.name = HOOK_LOAD_NAMES.box
    box.position.set(layout.center.x, layout.center.y, layout.center.z)
    box.rotation.y = ((layout.yawDeg ?? 0) * Math.PI) / 180
    box.castShadow = true
    box.receiveShadow = true

    const edges = new LineSegments(new EdgesGeometry(boxGeometry), this.edgesMaterial)
    edges.name = HOOK_LOAD_NAMES.edges
    edges.position.copy(box.position)
    edges.rotation.copy(box.rotation)

    const top = new Vector3(layout.slingTop.x, layout.slingTop.y, layout.slingTop.z)
    const slingPoints: Vector3[] = []
    for (const corner of layout.slingBottoms) {
      slingPoints.push(top, new Vector3(corner.x, corner.y, corner.z))
    }
    // Com acessórios, um filete liga o ponto do gancho ao das lingas (o espaço da cadeia). Não é
    // modelo de acessório: só mostra a distância; os modelos vêm de arquivos de terceiros (ADR-026).
    if (this.accessoriesDropM > 0) {
      slingPoints.push(
        new Vector3(0, -(this.hookReplaced ? REPLACED_HOOK_ATTACH_M : this.attachOffsetM), 0),
        top,
      )
    }
    const slings = new LineSegments(
      new BufferGeometry().setFromPoints(slingPoints),
      this.slingMaterial,
    )
    slings.name = HOOK_LOAD_NAMES.slings

    this.loadParts = [box, edges, slings]
    this.boxMesh = box
    this.edgesLines = edges
    this.root.add(...this.loadParts)
    this.attachCargoModel(layout, box)
  }

  /**
   * Tipo de carga com modelo 3D (leva F): o modelo, escalado para as medidas, toma o lugar da caixa
   * assim que chega (a caixa fica enquanto carrega ou se o arquivo falhar). Com a carga destacada por
   * uma colisão, volta a caixa vermelha. Só desenho: a colisão é pela caixa.
   */
  private attachCargoModel(layout: LoadBoxLayout, box: Mesh): void {
    const load = this.load
    if (!load || cargoModelId(load) === undefined) return
    const place = (): void => {
      // O quadro já pode ter sido refeito (medidas novas, outro gancho): só vale para a caixa atual.
      if (this.layout !== layout || this.boxMesh !== box) return
      const model = cargoModelInstance(load)
      if (!model) return
      model.name = HOOK_LOAD_NAMES.model
      // O modelo tem a origem no centro da base; a caixa, no centro.
      model.position.set(layout.center.x, layout.center.y - layout.size.y / 2, layout.center.z)
      model.rotation.y = box.rotation.y
      this.root.add(model)
      this.loadParts.push(model)
      this.cargoModel = model
      this.syncCargoModelVisibility()
      this.onModelReady?.()
    }
    if (cargoModels.peek(cargoModelId(load) ?? '')) place()
    else void loadCargoModel(load).then((loaded) => loaded && place())
  }

  /** Quem é avisado quando o modelo 3D da carga entra na cena (pede novo quadro). */
  setOnModelReady(callback: (() => void) | null): void {
    this.onModelReady = callback
  }

  private syncCargoModelVisibility(): void {
    const model = this.cargoModel
    if (!model) return
    const showModel = !this.highlighted
    model.visible = showModel
    if (this.boxMesh) this.boxMesh.visible = !showModel
    if (this.edgesLines) this.edgesLines.visible = !showModel
  }

  private clearLoad(): void {
    for (const part of this.loadParts) {
      part.removeFromParent()
      if (part instanceof Mesh || part instanceof LineSegments) part.geometry.dispose()
    }
    this.loadParts = []
    this.boxMesh = null
    this.edgesLines = null
    this.cargoModel = null
    this.layout = null
    this.load = null
  }

  /** Halo em volta da carga (elipsoide) ou, sem carga, do gancho medido. */
  private fitHalo(): void {
    const layout = this.layout
    if (layout) {
      this.halo.position.set(layout.center.x, layout.center.y, layout.center.z)
      this.halo.scale.set(
        (layout.size.x / 2) * LOAD_HALO_SCALE + 0.2,
        (layout.size.y / 2) * LOAD_HALO_SCALE + 0.2,
        (layout.size.z / 2) * LOAD_HALO_SCALE + 0.2,
      )
      return
    }
    const extent = this.hookExtent
    if (!extent) {
      this.halo.position.set(0, HOOK_HALO_CENTER_Y, 0)
      this.halo.scale.setScalar(HOOK_HALO_RADIUS_M)
      return
    }
    this.halo.position.copy(extent.center)
    this.halo.scale.set(
      extent.half.x * HOOK_HALO_SCALE + HOOK_HALO_MARGIN_M,
      extent.half.y * HOOK_HALO_SCALE + HOOK_HALO_MARGIN_M,
      extent.half.z * HOOK_HALO_SCALE + HOOK_HALO_MARGIN_M,
    )
  }
}
