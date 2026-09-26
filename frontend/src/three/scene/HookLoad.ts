import {
  AdditiveBlending,
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

import { computeLoadBox, type LoadDimensions, type LoadBoxLayout, sameLoad } from './loadBox'
import { type EvaluationStatus, SCENE_COLORS, statusColor } from './palette'

// Carga pendurada no gancho e halo de situação (TASK-041). Só desenho: não entra em nenhum cálculo.
// O grupo é filho do nó do gancho (origem em G), então acompanha o cabo sem tocar na cinemática.

export const HOOK_LOAD_NAMES = {
  root: 'hook-load',
  box: 'hook-load-box',
  edges: 'hook-load-edges',
  slings: 'hook-load-slings',
  halo: 'hook-load-halo',
} as const

/** Halo sem carga: esfera em volta do gancho provisório (centro e raio em m, locais de G). */
const HOOK_HALO_CENTER_Y = -0.55
const HOOK_HALO_RADIUS_M = 0.95
/** Quanto o halo passa das bordas da carga, em proporção das meias-medidas. */
const LOAD_HALO_SCALE = 1.25
/** Intensidade do brilho na borda: sutil, sem neon. */
export const HALO_INTENSITY = 0.35
/** Sem situação (`unknown`), o halo cinza fica ainda mais discreto: não há nada a destacar. */
export const HALO_INTENSITY_UNKNOWN = 0.15

// Brilho de borda (fresnel): quase transparente de frente, mais forte no contorno.
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
    roughness: 0.7,
    metalness: 0.2,
  })
  private readonly edgesMaterial = new LineBasicMaterial({
    color: SCENE_COLORS.loadEdges,
    transparent: true,
    opacity: 0.6,
  })
  private readonly slingMaterial = new LineBasicMaterial({ color: SCENE_COLORS.sling })
  private loadParts: Object3D[] = []
  private load: LoadDimensions | null = null
  private layout: LoadBoxLayout | null = null

  constructor(hook: Object3D) {
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
        blending: AdditiveBlending,
      }),
    )
    this.halo.name = HOOK_LOAD_NAMES.halo
    this.halo.renderOrder = 4
    this.root.add(this.halo)
    hook.add(this.root)
    this.fitHalo()
  }

  /** Caixa desenhada agora, ou `null` quando só há o gancho. */
  get currentLayout(): LoadBoxLayout | null {
    return this.layout
  }

  get haloColor(): Color {
    return this.halo.material.uniforms.color.value as Color
  }

  /** Mostra a caixa da carga pendurada pelas lingas, ou só o gancho com `null` ou medidas inválidas. */
  setLoad(load: LoadDimensions | null | undefined): void {
    if (sameLoad(load, this.load)) return
    this.clearLoad()
    this.layout = computeLoadBox(load)
    this.load = this.layout && load ? { ...load } : null
    if (this.layout) this.buildLoad(this.layout)
    this.fitHalo()
  }

  /** Cor do halo pela situação. */
  setStatus(status: EvaluationStatus): void {
    this.haloColor.setHex(statusColor(status))
    this.halo.material.uniforms.intensity.value =
      status === 'unknown' ? HALO_INTENSITY_UNKNOWN : HALO_INTENSITY
  }

  /** Intensidade atual do brilho do halo. */
  get haloIntensity(): number {
    return this.halo.material.uniforms.intensity.value as number
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

  private buildLoad(layout: LoadBoxLayout): void {
    const boxGeometry = new BoxGeometry(layout.size.x, layout.size.y, layout.size.z)
    const box = new Mesh(boxGeometry, this.boxMaterial)
    box.name = HOOK_LOAD_NAMES.box
    box.position.set(layout.center.x, layout.center.y, layout.center.z)
    box.castShadow = true
    box.receiveShadow = true

    const edges = new LineSegments(new EdgesGeometry(boxGeometry), this.edgesMaterial)
    edges.name = HOOK_LOAD_NAMES.edges
    edges.position.copy(box.position)

    const top = new Vector3(layout.slingTop.x, layout.slingTop.y, layout.slingTop.z)
    const slingPoints: Vector3[] = []
    for (const corner of layout.slingBottoms) {
      slingPoints.push(top, new Vector3(corner.x, corner.y, corner.z))
    }
    const slings = new LineSegments(
      new BufferGeometry().setFromPoints(slingPoints),
      this.slingMaterial,
    )
    slings.name = HOOK_LOAD_NAMES.slings

    this.loadParts = [box, edges, slings]
    this.root.add(...this.loadParts)
  }

  private clearLoad(): void {
    for (const part of this.loadParts) {
      part.removeFromParent()
      if (part instanceof Mesh || part instanceof LineSegments) part.geometry.dispose()
    }
    this.loadParts = []
    this.layout = null
    this.load = null
  }

  /** Halo em volta da carga (elipsoide) ou, sem carga, do gancho. */
  private fitHalo(): void {
    const layout = this.layout
    if (!layout) {
      this.halo.position.set(0, HOOK_HALO_CENTER_Y, 0)
      this.halo.scale.setScalar(HOOK_HALO_RADIUS_M)
      return
    }
    this.halo.position.set(layout.center.x, layout.center.y, layout.center.z)
    this.halo.scale.set(
      (layout.size.x / 2) * LOAD_HALO_SCALE + 0.2,
      (layout.size.y / 2) * LOAD_HALO_SCALE + 0.2,
      (layout.size.z / 2) * LOAD_HALO_SCALE + 0.2,
    )
  }
}
