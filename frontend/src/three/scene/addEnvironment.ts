import {
  BackSide,
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  Mesh,
  MeshLambertMaterial,
  PlaneGeometry,
  type Scene,
  ShaderMaterial,
  SphereGeometry,
  type Vector3,
} from 'three'

import { SCENE_COLORS } from './palette'

// Ambiente escuro de "software 3D" (TASK-041): céu em gradiente, chão grafite com névoa até o
// horizonte, grade técnica que esmaece com a distância e luz com sombras suaves.

/** Lado do chão (m): bem maior que o alcance da névoa, para a borda nunca aparecer. */
export const GROUND_SIZE_M = 1200
/** Linhas secundárias da grade a cada 1 m e principais a cada 5 m (CA-1). */
export const GRID_MINOR_SPACING_M = 1
export const GRID_MAJOR_SPACING_M = 5
/** Raio do domo do céu (m); ele acompanha a câmera, então não precisa cobrir a cena toda. */
export const SKY_RADIUS_M = 600

/** Distâncias (m) da névoa e do esmaecimento da grade para a câmera a `cameraDistanceM` do alvo. */
export interface AtmosphereRange {
  readonly fogNearM: number
  readonly fogFarM: number
  readonly gridFadeNearM: number
  readonly gridFadeFarM: number
}

/**
 * A névoa e o esmaecimento da grade acompanham o zoom: perto do guindaste a grade aparece nítida, e ao
 * afastar a câmera o guindaste não some na névoa.
 */
export function atmosphereRange(cameraDistanceM: number): AtmosphereRange {
  const distance = Math.max(0, cameraDistanceM)
  return {
    fogNearM: distance + 30,
    fogFarM: distance + 260,
    gridFadeNearM: distance * 0.4 + 6,
    gridFadeFarM: distance * 1.3 + 30,
  }
}

/** O que o laço de renderização precisa atualizar no ambiente a cada quadro. */
export interface SceneEnvironment {
  readonly sun: DirectionalLight
  readonly grid: Mesh
  readonly sky: Mesh
  /** Ajusta a sombra ao alcance do guindaste (m), para não desperdiçar resolução do mapa. */
  fitShadowToReach(reachM: number): void
  /** Céu atrás da câmera; névoa e grade na distância certa. */
  update(cameraPosition: Vector3, cameraDistanceM: number): void
}

const SKY_VERTEX = /* glsl */ `
varying vec3 vDirection;
void main() {
  vDirection = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const SKY_FRAGMENT = /* glsl */ `
uniform vec3 zenithColor;
uniform vec3 horizonColor;
varying vec3 vDirection;
void main() {
  float h = clamp(vDirection.y, 0.0, 1.0);
  vec3 color = mix(horizonColor, zenithColor, smoothstep(0.0, 0.55, h));
  gl_FragColor = vec4(color, 1.0);
  // Mesmo tone mapping do chão com névoa: sem faixa visível no horizonte.
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

const GRID_VERTEX = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`

// Linhas com largura constante em pixels (fwidth), sem serrilhado nem moiré ao longe; as secundárias
// somem antes das principais.
const GRID_FRAGMENT = /* glsl */ `
uniform vec3 minorColor;
uniform vec3 majorColor;
uniform float minorSpacing;
uniform float majorSpacing;
uniform float fadeNear;
uniform float fadeFar;
varying vec3 vWorld;

float gridLine(vec2 p, float spacing, float widthPx) {
  vec2 cell = p / spacing;
  vec2 d = abs(fract(cell - 0.5) - 0.5) / fwidth(cell);
  return 1.0 - min(min(d.x, d.y) / widthPx, 1.0);
}

void main() {
  float distanceToCamera = distance(cameraPosition, vWorld);
  float fade = 1.0 - smoothstep(fadeNear, fadeFar, distanceToCamera);
  float minorFade = 1.0 - smoothstep(fadeNear * 0.5, fadeFar * 0.55, distanceToCamera);
  float minor = gridLine(vWorld.xz, minorSpacing, 1.0) * minorFade * 0.55;
  float major = gridLine(vWorld.xz, majorSpacing, 1.3) * 0.7;
  float alpha = max(minor, major) * fade;
  if (alpha < 0.004) discard;
  vec3 color = major >= minor ? majorColor : minorColor;
  gl_FragColor = vec4(color, alpha);
  #include <colorspace_fragment>
}
`

/** Adiciona céu, névoa, luzes, chão e grade à cena. O chão fica no plano y = 0. */
export function addEnvironment(scene: Scene): SceneEnvironment {
  const horizon = new Color(SCENE_COLORS.skyHorizon)
  scene.background = horizon.clone()
  const initialRange = atmosphereRange(40)
  const fog = new Fog(horizon.clone(), initialRange.fogNearM, initialRange.fogFarM)
  scene.fog = fog

  const sky = new Mesh(
    new SphereGeometry(SKY_RADIUS_M, 32, 16),
    new ShaderMaterial({
      name: 'environment-sky',
      uniforms: {
        zenithColor: { value: new Color(SCENE_COLORS.skyZenith) },
        horizonColor: { value: horizon.clone() },
      },
      vertexShader: SKY_VERTEX,
      fragmentShader: SKY_FRAGMENT,
      side: BackSide,
      depthWrite: false,
      fog: false,
    }),
  )
  sky.name = 'environment-sky'
  sky.renderOrder = -1
  sky.frustumCulled = false
  scene.add(sky)

  const hemisphere = new HemisphereLight(0xbcd0ec, 0x151a21, 1.15)
  hemisphere.name = 'environment-hemisphere-light'
  scene.add(hemisphere)

  const sun = new DirectionalLight(0xfff4e5, 2.6)
  sun.name = 'environment-sun'
  sun.position.set(24, 42, 18)
  sun.castShadow = true
  // 2048² com PCF e raio pequeno: sombra suave e barata o bastante para 60 fps num notebook comum.
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.radius = 3
  sun.shadow.bias = -0.0004
  sun.shadow.normalBias = 0.03
  sun.shadow.camera.near = 1
  sun.shadow.camera.far = 140
  scene.add(sun)
  scene.add(sun.target)

  // Luz de recorte fria, por trás, sem sombra: separa o guindaste do fundo escuro.
  const rim = new DirectionalLight(0x7ea6ff, 0.55)
  rim.name = 'environment-rim-light'
  rim.position.set(-30, 18, -26)
  scene.add(rim)

  const ground = new Mesh(
    new PlaneGeometry(GROUND_SIZE_M, GROUND_SIZE_M),
    // Lambert: sem reflexo especular rasante, que clareava o chão perto do horizonte.
    new MeshLambertMaterial({ color: SCENE_COLORS.ground }),
  )
  ground.name = 'environment-ground'
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  scene.add(ground)

  const gridMaterial = new ShaderMaterial({
    name: 'environment-grid',
    uniforms: {
      minorColor: { value: new Color(SCENE_COLORS.gridMinor) },
      majorColor: { value: new Color(SCENE_COLORS.gridMajor) },
      minorSpacing: { value: GRID_MINOR_SPACING_M },
      majorSpacing: { value: GRID_MAJOR_SPACING_M },
      fadeNear: { value: initialRange.gridFadeNearM },
      fadeFar: { value: initialRange.gridFadeFarM },
    },
    vertexShader: GRID_VERTEX,
    fragmentShader: GRID_FRAGMENT,
    transparent: true,
    depthWrite: false,
    // Um pouco à frente do chão na profundidade, sem sair do plano y = 0.
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  })
  // A grade só precisa cobrir até onde o esmaecimento chega com o zoom máximo.
  const grid = new Mesh(new PlaneGeometry(600, 600), gridMaterial)
  grid.name = 'environment-grid'
  grid.rotation.x = -Math.PI / 2
  grid.position.y = 0.002
  scene.add(grid)

  return {
    sun,
    grid,
    sky,
    fitShadowToReach(reachM: number) {
      const half = Math.max(reachM, 10) + 8
      const camera = sun.shadow.camera
      camera.left = -half
      camera.right = half
      camera.top = half
      camera.bottom = -half
      camera.updateProjectionMatrix()
    },
    update(cameraPosition: Vector3, cameraDistanceM: number) {
      sky.position.copy(cameraPosition)
      const range = atmosphereRange(cameraDistanceM)
      fog.near = range.fogNearM
      fog.far = range.fogFarM
      gridMaterial.uniforms.fadeNear.value = range.gridFadeNearM
      gridMaterial.uniforms.fadeFar.value = range.gridFadeFarM
    },
  }
}
