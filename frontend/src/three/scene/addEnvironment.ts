import {
  Color,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  type Scene,
  ShaderMaterial,
  ShadowMaterial,
  type Vector3,
} from 'three'

import { SCENE_COLORS } from './palette'

// Prancha técnica viva (TASK-047; ADR-019): fundo e chão no mesmo papel, sem céu nem névoa; grade de
// papel milimetrado que esmaece com a distância, eixos de referência em tinta e luz clara e neutra
// com sombra discreta, de desenho.

/** Lado do chão (m): o chão tem a cor do fundo, então a borda nunca aparece. */
export const GROUND_SIZE_M = 1200
/** Lado da grade (m): ela acompanha a câmera e esmaece bem antes da borda. */
export const GRID_SIZE_M = 600
/** Linhas secundárias da grade a cada 1 m e principais a cada 5 m (CA-1). */
export const GRID_MINOR_SPACING_M = 1
export const GRID_MAJOR_SPACING_M = 5
/** Opacidade da sombra no chão: presente, mas discreta (sombra de desenho, não dramática). */
export const GROUND_SHADOW_OPACITY = 0.14

/** Distâncias (m) do esmaecimento da grade para a câmera a `cameraDistanceM` do alvo. */
export interface AtmosphereRange {
  readonly gridFadeNearM: number
  readonly gridFadeFarM: number
}

/**
 * O esmaecimento da grade acompanha o zoom: perto do guindaste a grade aparece nítida, e ao afastar a
 * câmera ela some no papel antes de virar moiré.
 */
export function atmosphereRange(cameraDistanceM: number): AtmosphereRange {
  const distance = Math.max(0, cameraDistanceM)
  return {
    gridFadeNearM: distance * 0.6 + 10,
    gridFadeFarM: distance * 1.5 + 35,
  }
}

/** O que o laço de renderização precisa atualizar no ambiente a cada quadro. */
export interface SceneEnvironment {
  readonly sun: DirectionalLight
  readonly grid: Mesh
  readonly ground: Mesh
  /** Plano que só recebe a sombra, em tinta translúcida sobre o papel. */
  readonly groundShadow: Mesh
  /** Ajusta a sombra ao alcance do guindaste (m), para não desperdiçar resolução do mapa. */
  fitShadowToReach(reachM: number): void
  /** Grade sob a câmera e esmaecimento na distância certa. */
  update(cameraPosition: Vector3, cameraDistanceM: number): void
}

const GRID_VERTEX = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`

// Linhas com largura constante em pixels (fwidth), sem serrilhado nem moiré ao longe; as secundárias
// somem antes das principais. Os eixos X e Z pela origem são linhas de centro (traço e ponto), como no
// desenho técnico. Sem tone mapping: as cores saem exatamente as da paleta.
const GRID_FRAGMENT = /* glsl */ `
uniform vec3 minorColor;
uniform vec3 majorColor;
uniform vec3 axisColor;
uniform float minorSpacing;
uniform float majorSpacing;
uniform float fadeNear;
uniform float fadeFar;
varying vec3 vWorld;

// Linha da grade com o espaçamento dado; some quando as linhas ficam a menos de ~6 px uma da outra na
// tela, antes de virar moiré (perto do horizonte ou com a câmera longe).
float gridLine(vec2 p, float spacing, float widthPx) {
  vec2 cell = p / spacing;
  vec2 cellsPerPx = fwidth(cell);
  vec2 d = abs(fract(cell - 0.5) - 0.5) / cellsPerPx;
  float line = 1.0 - min(min(d.x, d.y) / widthPx, 1.0);
  float density = max(cellsPerPx.x, cellsPerPx.y);
  return line * (1.0 - smoothstep(0.12, 0.3, density));
}

// Traço longo, falha, ponto, falha: padrão de 4 m ao longo do eixo.
float centerDash(float t) {
  float m = mod(t, 4.0);
  return (m < 2.6 || (m > 3.1 && m < 3.5)) ? 1.0 : 0.0;
}

float axisLine(float across, float along, float widthPx) {
  float d = abs(across) / fwidth(across);
  return (1.0 - min(d / widthPx, 1.0)) * centerDash(along);
}

void main() {
  float distanceToCamera = distance(cameraPosition, vWorld);
  float fade = 1.0 - smoothstep(fadeNear, fadeFar, distanceToCamera);
  float minor = gridLine(vWorld.xz, minorSpacing, 1.0);
  float major = gridLine(vWorld.xz, majorSpacing, 1.2);
  float axis = max(axisLine(vWorld.z, vWorld.x, 1.2), axisLine(vWorld.x, vWorld.z, 1.2));
  vec3 color = minorColor;
  float alpha = minor;
  if (major >= alpha) {
    color = majorColor;
    alpha = major;
  }
  // O eixo passa por cima da linha de 5 m que coincide com ele.
  if (axis > 0.0 && axis >= alpha * 0.5) {
    color = axisColor;
    alpha = max(alpha, axis * 0.75);
  }
  alpha *= fade;
  if (alpha < 0.004) discard;
  gl_FragColor = vec4(color, alpha);
  #include <colorspace_fragment>
}
`

/** Adiciona fundo, luzes, chão, sombra e grade à cena. O chão fica no plano y = 0. */
export function addEnvironment(scene: Scene): SceneEnvironment {
  scene.background = new Color(SCENE_COLORS.background)
  // Sem névoa: o esmaecimento da grade faz o papel do horizonte, sem escurecer nem velar o guindaste.
  scene.fog = null

  // Luz clara e neutra: céu branco e o chão devolvendo o tom do papel, sem luz colorida de recorte.
  const hemisphere = new HemisphereLight(0xffffff, 0xe6e0d2, 1.5)
  hemisphere.name = 'environment-hemisphere-light'
  scene.add(hemisphere)

  const sun = new DirectionalLight(0xffffff, 2.1)
  sun.name = 'environment-sun'
  // Alto e de lado: sombra curta, logo ao lado do guindaste e visível da vista em perspectiva.
  sun.position.set(-22, 46, 10)
  sun.castShadow = true
  // 2048² com PCF e raio largo: borda macia e barata o bastante para 60 fps num notebook comum.
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.radius = 5
  sun.shadow.bias = -0.0004
  sun.shadow.normalBias = 0.03
  sun.shadow.camera.near = 1
  sun.shadow.camera.far = 140
  scene.add(sun)
  scene.add(sun.target)

  // Luz de preenchimento neutra, por trás, sem sombra: o lado oposto ao sol não fica chapado.
  const fill = new DirectionalLight(0xffffff, 0.6)
  fill.name = 'environment-fill-light'
  fill.position.set(26, 18, -22)
  scene.add(fill)

  // Chão sem luz, exatamente da cor do fundo: nenhuma emenda no horizonte.
  const ground = new Mesh(
    new PlaneGeometry(GROUND_SIZE_M, GROUND_SIZE_M),
    new MeshBasicMaterial({ color: SCENE_COLORS.ground, toneMapped: false, fog: false }),
  )
  ground.name = 'environment-ground'
  ground.rotation.x = -Math.PI / 2
  scene.add(ground)

  // A sombra fica num plano à parte, que só a recebe: tinta translúcida sobre o papel.
  const groundShadow = new Mesh(
    new PlaneGeometry(GROUND_SIZE_M / 4, GROUND_SIZE_M / 4),
    new ShadowMaterial({
      color: SCENE_COLORS.shadow,
      opacity: GROUND_SHADOW_OPACITY,
      depthWrite: false,
      toneMapped: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
  )
  groundShadow.name = 'environment-ground-shadow'
  groundShadow.rotation.x = -Math.PI / 2
  groundShadow.position.y = 0.001
  groundShadow.receiveShadow = true
  groundShadow.renderOrder = -1
  scene.add(groundShadow)

  const initialRange = atmosphereRange(40)
  const gridMaterial = new ShaderMaterial({
    name: 'environment-grid',
    uniforms: {
      minorColor: { value: new Color(SCENE_COLORS.gridMinor) },
      majorColor: { value: new Color(SCENE_COLORS.gridMajor) },
      axisColor: { value: new Color(SCENE_COLORS.gridAxis) },
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
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  })
  const grid = new Mesh(new PlaneGeometry(GRID_SIZE_M, GRID_SIZE_M), gridMaterial)
  grid.name = 'environment-grid'
  grid.rotation.x = -Math.PI / 2
  grid.position.y = 0.002
  scene.add(grid)

  return {
    sun,
    grid,
    ground,
    groundShadow,
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
      // As linhas são calculadas em coordenadas do mundo: mover o plano não as desloca.
      grid.position.x = cameraPosition.x
      grid.position.z = cameraPosition.z
      const range = atmosphereRange(cameraDistanceM)
      gridMaterial.uniforms.fadeNear.value = range.gridFadeNearM
      gridMaterial.uniforms.fadeFar.value = range.gridFadeFarM
    },
  }
}
