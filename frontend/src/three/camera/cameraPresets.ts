// Predefinições de câmera e limites da órbita (TASK-041), sem Three.js: a UI pode importar os tipos.
//
// Os enquadramentos usam a geometria de PRÉ-VISUALIZAÇÃO do `CraneController` (ADR-013 C-5) só para
// apontar a câmera; não mexem na cinemática nem no cálculo.
//
// Desde a TASK-047, a distância sai do campo de visão e da proporção do quadro: o conjunto (guindaste,
// lança e anel de raio) cabe com folga tanto num quadro largo (16:9) quanto num quadro em coluna.

import type { OperationalGeometry } from '../../domain/geometry/operationalGeometry'

/** Predefinições de câmera da cena. */
export type CameraPreset = 'perspectiva' | 'lateral' | 'topo' | 'operador'

export const CAMERA_PRESETS: readonly CameraPreset[] = [
  'perspectiva',
  'lateral',
  'topo',
  'operador',
]

export interface Vec3 {
  readonly x: number
  readonly y: number
  readonly z: number
}

/** Posição da câmera e ponto para onde ela olha (o alvo da órbita), em metros. */
export interface CameraView {
  readonly position: Vec3
  readonly target: Vec3
}

/** Campo de visão vertical da câmera (°), o mesmo de `createCamera`. */
export const CAMERA_FOV_DEG = 50
/** Proporção do quadro quando quem pede o enquadramento não informa (16:9). */
export const DEFAULT_CAMERA_ASPECT = 16 / 9

/** O que os enquadramentos precisam saber do guindaste. */
export interface CameraFraming {
  readonly turretRotationDeg: number
  readonly geometry: Pick<OperationalGeometry, 'workingRadiusM' | 'tipHeightM' | 'hook'> &
    Partial<Pick<OperationalGeometry, 'boomTip'>>
  /** Maior raio alcançável (m), para enquadrar a lança toda estendida. */
  readonly maxReachM: number
  /**
   * Olho do operador no referencial da base com ψ = 0 (m), medido no modelo em uso (vidro da cabine
   * da torre). Sem ele, vale `OPERATOR_EYE_LOCAL`, do modelo provisório.
   */
  readonly operatorEye?: Vec3
  /** Largura ÷ altura do quadro. Padrão: `DEFAULT_CAMERA_ASPECT`. */
  readonly aspect?: number
  /** Campo de visão vertical (°). Padrão: `CAMERA_FOV_DEG`. */
  readonly fovDeg?: number
}

/** Limites da órbita: distância ao alvo e altura mínima da câmera acima do chão (y = 0). */
export const CAMERA_LIMITS = Object.freeze({
  minDistanceM: 4,
  maxDistanceM: 160,
  /** A câmera nunca desce abaixo disto, para não atravessar o chão. */
  minHeightM: 0.4,
  /** Ângulo polar máximo (a partir do zênite) mesmo com o alvo alto: nunca olha 100% para cima. */
  maxPolarAngleRad: Math.PI * 0.92,
})

/** Duração da transição entre predefinições (ms); zero com `prefers-reduced-motion`. */
export const CAMERA_TRANSITION_MS = 700

/**
 * Chassi do caminhão no referencial da base (m): fixo, não gira com a torre. Medido no GLB da
 * TASK-043 (cabine para +Z), com folga; o provisório cabe dentro.
 */
export const CARRIER_FOOTPRINT = Object.freeze({
  xMinM: -1.5,
  xMaxM: 1.5,
  zMinM: -2.8,
  zMaxM: 6.6,
  heightM: 3.8,
})

/** Folga acima da ponta da lança (m), para a cabeça com as polias não encostar na borda. */
const BOOM_HEAD_MARGIN_M = 1.2

/**
 * Vista em perspectiva (TASK-047): 3/4 pela frente e à direita do caminhão, olhando de cima em
 * ângulo baixo. Com o campo de visão de 50°, a inclinação de 13° põe o horizonte no terço de cima.
 */
export const PERSPECTIVE_AZIMUTH_DEG = 40
export const PERSPECTIVE_ELEVATION_DEG = 13
/**
 * Quanto do quadro o conjunto ocupa: na largura, cerca de 2/3 (o anel de raio, na pose inicial); na
 * altura, com folga para a lança não encostar na borda.
 */
export const PERSPECTIVE_FILL = Object.freeze({ width: 0.66, height: 0.88 })
/**
 * Em quadros mais altos que largos, a câmera sobe (até +17°) e o conjunto ocupa mais da largura: o
 * anel fica mais redondo e preenche a altura, em vez de virar uma faixa no meio de papel vazio.
 */
const TALL_FRAME = Object.freeze({
  fromAspect: 1.1,
  toAspect: 0.6,
  extraElevationDeg: 17,
  extraWidthFill: 0.12,
})

/** Inclinação e ocupação da vista em perspectiva para a proporção do quadro. */
export function perspectiveForAspect(aspect: number): {
  readonly elevationDeg: number
  readonly fill: { readonly width: number; readonly height: number }
} {
  const tall = Math.min(
    1,
    Math.max(0, (TALL_FRAME.fromAspect - aspect) / (TALL_FRAME.fromAspect - TALL_FRAME.toAspect)),
  )
  return {
    elevationDeg: PERSPECTIVE_ELEVATION_DEG + tall * TALL_FRAME.extraElevationDeg,
    fill: {
      width: PERSPECTIVE_FILL.width + tall * TALL_FRAME.extraWidthFill,
      height: PERSPECTIVE_FILL.height,
    },
  }
}
/** Vista lateral: quase na horizontal, um pouco de cima. */
const LATERAL_ELEVATION_DEG = 5
const LATERAL_FILL = Object.freeze({ width: 0.8, height: 0.8 })
/** Vista de topo: o círculo de alcance máximo inteiro, com margem. */
const TOP_FILL = Object.freeze({ width: 0.85, height: 0.85 })

/**
 * Olho do operador no modelo PROVISÓRIO (m, referencial da base com ψ = 0): logo acima da cabine da
 * torre, que fica do lado +X (`createProvisionalCrane`). Com o GLB real, virá de um nó do modelo.
 */
export const OPERATOR_EYE_LOCAL: Vec3 = { x: 1.4, y: 3.2, z: 0.4 }

const DEG = Math.PI / 180

/** Gira `point` em torno do eixo Y por ψ, como `rotation.y` da torre (ADR-013 C-2). */
export function rotateAroundY(point: Vec3, turretRotationDeg: number): Vec3 {
  const psi = turretRotationDeg * DEG
  const cos = Math.cos(psi)
  const sin = Math.sin(psi)
  return { x: point.x * cos + point.z * sin, y: point.y, z: -point.x * sin + point.z * cos }
}

function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x }
}

function normalize(a: Vec3): Vec3 {
  const length = Math.hypot(a.x, a.y, a.z) || 1
  return { x: a.x / length, y: a.y / length, z: a.z / length }
}

/** Direção do alvo para a câmera com azimute (0° = +Z, 90° = +X) e elevação acima do horizonte. */
function viewDirection(azimuthDeg: number, elevationDeg: number): Vec3 {
  const azimuth = azimuthDeg * DEG
  const elevation = elevationDeg * DEG
  return {
    x: Math.sin(azimuth) * Math.cos(elevation),
    y: Math.sin(elevation),
    z: Math.cos(azimuth) * Math.cos(elevation),
  }
}

/** Centro da caixa alinhada aos eixos que contém os pontos. */
export function boundsCenter(points: readonly Vec3[]): Vec3 {
  const min = { x: Infinity, y: Infinity, z: Infinity }
  const max = { x: -Infinity, y: -Infinity, z: -Infinity }
  for (const p of points) {
    min.x = Math.min(min.x, p.x)
    min.y = Math.min(min.y, p.y)
    min.z = Math.min(min.z, p.z)
    max.x = Math.max(max.x, p.x)
    max.y = Math.max(max.y, p.y)
    max.z = Math.max(max.z, p.z)
  }
  return { x: (min.x + max.x) / 2, y: (min.y + max.y) / 2, z: (min.z + max.z) / 2 }
}

/** Como a câmera vê o quadro: campo de visão, proporção e quanto dele o conjunto deve ocupar. */
export interface FitOptions {
  readonly fovDeg: number
  readonly aspect: number
  readonly fill: { readonly width: number; readonly height: number }
  /** "Para cima" da tela; padrão +Y. Na vista de topo, +Y coincide com a direção de visão. */
  readonly up?: Vec3
}

/**
 * Menor distância do alvo, na direção `direction` (do alvo para a câmera), em que todos os pontos
 * cabem na fração `fill` do quadro. Exata para a projeção perspectiva: para cada ponto, a distância
 * lateral na tela é comparada à meia-abertura do campo de visão na profundidade do ponto.
 */
export function fitDistance(
  points: readonly Vec3[],
  target: Vec3,
  direction: Vec3,
  options: FitOptions,
): number {
  const back = normalize(direction)
  const right = normalize(cross(options.up ?? { x: 0, y: 1, z: 0 }, back))
  const up = cross(back, right)
  const tanHalfV = Math.tan((options.fovDeg * DEG) / 2) * options.fill.height
  const tanHalfH = Math.tan((options.fovDeg * DEG) / 2) * options.aspect * options.fill.width
  let distance = 0
  for (const point of points) {
    const offset = sub(point, target)
    const depth = dot(offset, back)
    distance = Math.max(
      distance,
      depth + Math.abs(dot(offset, right)) / tanHalfH,
      depth + Math.abs(dot(offset, up)) / tanHalfV,
    )
  }
  return distance
}

/**
 * Alvo e distância que enquadram os pontos na direção dada, com o conjunto centrado na tela: o alvo
 * começa no centro da caixa dos pontos e é deslocado até o meio do que a câmera vê (em perspectiva,
 * o que está perto aparece maior, então o centro da caixa não fica no meio da tela). O alvo nunca
 * desce abaixo do chão.
 */
export function fitCentered(
  points: readonly Vec3[],
  direction: Vec3,
  options: FitOptions,
): { readonly target: Vec3; readonly distance: number } {
  const back = normalize(direction)
  const right = normalize(cross(options.up ?? { x: 0, y: 1, z: 0 }, back))
  const up = cross(back, right)
  const tanHalfV = Math.tan((options.fovDeg * DEG) / 2)
  const tanHalfH = tanHalfV * options.aspect
  let target = boundsCenter(points)
  let distance = fitDistance(points, target, back, options)
  for (let iteration = 0; iteration < 4; iteration += 1) {
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    for (const point of points) {
      const offset = sub(point, target)
      const depth = distance - dot(offset, back)
      if (!(depth > 0)) continue
      const x = dot(offset, right) / (depth * tanHalfH)
      const y = dot(offset, up) / (depth * tanHalfV)
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y)
    }
    if (!Number.isFinite(minX)) break
    const shiftX = ((minX + maxX) / 2) * distance * tanHalfH
    const shiftY = ((minY + maxY) / 2) * distance * tanHalfV
    target = {
      x: target.x + right.x * shiftX + up.x * shiftY,
      y: Math.max(0, target.y + right.y * shiftX + up.y * shiftY),
      z: target.z + right.z * shiftX + up.z * shiftY,
    }
    distance = fitDistance(points, target, back, options)
  }
  return { target, distance }
}

/** Pontos de um círculo no chão (y = 0), centrado no eixo de giro. */
function groundCircle(radius: number, samples = 24): Vec3[] {
  const points: Vec3[] = []
  for (let index = 0; index < samples; index += 1) {
    const angle = (index / samples) * 2 * Math.PI
    points.push({ x: radius * Math.sin(angle), y: 0, z: radius * Math.cos(angle) })
  }
  return points
}

/** Cantos do chassi, no chão e no alto da cabine. */
function carrierCorners(): Vec3[] {
  const f = CARRIER_FOOTPRINT
  const corners: Vec3[] = []
  for (const x of [f.xMinM, f.xMaxM])
    for (const z of [f.zMinM, f.zMaxM]) for (const y of [0, f.heightM]) corners.push({ x, y, z })
  return corners
}

/** Pontos que o conjunto ocupa agora: chassi, anel de raio, ponta da lança e gancho. */
export function framingPoints(framing: CameraFraming): Vec3[] {
  const radius = Math.max(framing.geometry.workingRadiusM ?? 0, 0)
  const hook = framing.geometry.hook
  const tip = framing.geometry.boomTip ?? {
    xM: hook.xM,
    yM: framing.geometry.tipHeightM,
    zM: hook.zM,
  }
  return [
    ...carrierCorners(),
    ...(radius > 0 ? groundCircle(radius) : []),
    // A cabeça da lança (polias) passa um pouco da ponta calculada.
    { x: tip.xM, y: tip.yM + BOOM_HEAD_MARGIN_M, z: tip.zM },
    { x: hook.xM, y: Math.max(hook.yM, 0), z: hook.zM },
  ]
}

function place(target: Vec3, direction: Vec3, distance: number): CameraView {
  const d = clampDistance(distance)
  return {
    position: {
      x: target.x + direction.x * d,
      y: target.y + direction.y * d,
      z: target.z + direction.z * d,
    },
    target,
  }
}

/**
 * Enquadramento de cada predefinição, ajustado ao campo de visão e à proporção do quadro:
 * - `perspectiva`: vista 3/4 baixa, com o alvo no centro do conjunto (guindaste e anel de raio) e o
 *   horizonte no terço de cima; o anel ocupa cerca de 2/3 da largura na pose inicial;
 * - `lateral`: perpendicular ao plano da lança (vê θ, o raio e as alturas de lado);
 * - `topo`: de cima, com o círculo de alcance máximo inteiro no quadro;
 * - `operador`: do olho do operador na torre, olhando para o gancho.
 */
export function resolveCameraPreset(preset: CameraPreset, framing: CameraFraming): CameraView {
  const reach = Math.max(framing.maxReachM, 1)
  const radius = Math.max(framing.geometry.workingRadiusM ?? 0, 0)
  const psi = framing.turretRotationDeg * DEG
  const along = { x: Math.sin(psi), z: Math.cos(psi) }
  const fovDeg = framing.fovDeg ?? CAMERA_FOV_DEG
  const aspect =
    framing.aspect !== undefined && Number.isFinite(framing.aspect) && framing.aspect > 0
      ? framing.aspect
      : DEFAULT_CAMERA_ASPECT

  switch (preset) {
    case 'lateral': {
      // Lado direito da lança: n = u(ψ) girado −90° em Y.
      const side = { x: Math.cos(psi), z: -Math.sin(psi) }
      const height = Math.max(framing.geometry.tipHeightM, 2)
      // Alvo no plano da lança, entre o eixo de giro e o gancho: a órbita gira em torno da lança.
      const target: Vec3 = { x: (along.x * radius) / 2, y: height / 2, z: (along.z * radius) / 2 }
      const elevation = LATERAL_ELEVATION_DEG * DEG
      const direction: Vec3 = {
        x: side.x * Math.cos(elevation),
        y: Math.sin(elevation),
        z: side.z * Math.cos(elevation),
      }
      // Na lateral entram só a lança, o gancho e o eixo de giro: o chassi atravessado alargaria o quadro.
      const hook = framing.geometry.hook
      const points: Vec3[] = [
        { x: 0, y: 0, z: 0 },
        { x: 0, y: CARRIER_FOOTPRINT.heightM, z: 0 },
        { x: along.x * radius, y: 0, z: along.z * radius },
        { x: hook.xM, y: framing.geometry.tipHeightM + BOOM_HEAD_MARGIN_M, z: hook.zM },
        { x: -along.x * 3, y: 0, z: -along.z * 3 },
      ]
      const distance = fitDistance(points, target, direction, {
        fovDeg,
        aspect,
        fill: LATERAL_FILL,
      })
      return place(target, direction, distance)
    }
    case 'topo': {
      const target: Vec3 = { x: 0, y: 0, z: 0 }
      // Um desvio mínimo em Z mantém a orientação (+Z para baixo na tela) bem definida.
      const direction = normalize({ x: 0, y: 1, z: 0.001 })
      const points = [...groundCircle(reach + 1), ...framingPoints(framing)]
      const distance = fitDistance(points, target, direction, {
        fovDeg,
        aspect,
        fill: TOP_FILL,
        up: { x: 0, y: 0, z: -1 },
      })
      return place(target, direction, distance)
    }
    case 'operador': {
      const eye = rotateAroundY(
        framing.operatorEye ?? OPERATOR_EYE_LOCAL,
        framing.turretRotationDeg,
      )
      const hook = framing.geometry.hook
      return { position: eye, target: { x: hook.xM, y: Math.max(hook.yM, 0), z: hook.zM } }
    }
    case 'perspectiva':
    default: {
      const { elevationDeg, fill } = perspectiveForAspect(aspect)
      const direction = viewDirection(PERSPECTIVE_AZIMUTH_DEG, elevationDeg)
      const { target, distance } = fitCentered(framingPoints(framing), direction, {
        fovDeg,
        aspect,
        fill,
      })
      return place(target, direction, distance)
    }
  }
}

function clampDistance(distance: number): number {
  return Math.min(CAMERA_LIMITS.maxDistanceM, Math.max(CAMERA_LIMITS.minDistanceM, distance))
}

/**
 * Maior ângulo polar (a partir do zênite) que mantém a câmera a pelo menos `minHeightM` do chão,
 * orbitando a `distance` de um alvo na altura `targetY`: y = targetY + distance·cos(polar) ≥ minHeightM.
 * Com o alvo alto, a câmera pode olhar um pouco para cima (vista do operador); com o alvo no chão,
 * fica acima do plano do alvo. Nunca passa de `CAMERA_LIMITS.maxPolarAngleRad`.
 */
export function maxPolarAngleAboveGround(
  targetY: number,
  distance: number,
  minHeightM: number = CAMERA_LIMITS.minHeightM,
): number {
  if (!(distance > 0)) return Math.PI / 2
  const cosine = Math.min(1, Math.max(-1, (minHeightM - targetY) / distance))
  return Math.min(CAMERA_LIMITS.maxPolarAngleRad, Math.acos(cosine))
}

/** A câmera da vista fica acima do chão e dentro dos limites de distância? */
export function isViewWithinLimits(view: CameraView): boolean {
  const dx = view.position.x - view.target.x
  const dy = view.position.y - view.target.y
  const dz = view.position.z - view.target.z
  const distance = Math.hypot(dx, dy, dz)
  return (
    view.position.y >= CAMERA_LIMITS.minHeightM &&
    view.target.y >= 0 &&
    distance >= CAMERA_LIMITS.minDistanceM &&
    distance <= CAMERA_LIMITS.maxDistanceM
  )
}
