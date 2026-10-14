// Caixas orientadas (OBB), teste por eixos separadores (SAT) e segmentos, sem Three.js (TASK-053;
// ADR-028). Eixos da cena do ADR-013: Y para cima, metros. Só geometria: nada aqui decide capacidade
// ou segurança da operação (RN-008).

export interface Vec3 {
  readonly x: number
  readonly y: number
  readonly z: number
}

/** Matriz 3×3 em linhas (row-major): `[m00, m01, m02, m10, m11, m12, m20, m21, m22]`. */
export type Mat3 = readonly [number, number, number, number, number, number, number, number, number]

export const IDENTITY: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1]

/** Rotação de `rad` em torno de +Y (mesmo sentido de `rotation.y` do Three.js: +Z vai para +X). */
export function rotY(rad: number): Mat3 {
  const c = Math.cos(rad)
  const s = Math.sin(rad)
  return [c, 0, s, 0, 1, 0, -s, 0, c]
}

/** Rotação de `rad` em torno de +X (mesmo sentido de `rotation.x` do Three.js). */
export function rotX(rad: number): Mat3 {
  const c = Math.cos(rad)
  const s = Math.sin(rad)
  return [1, 0, 0, 0, c, -s, 0, s, c]
}

export function mulMat(a: Mat3, b: Mat3): Mat3 {
  const out: number[] = []
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      out.push(a[row * 3] * b[col] + a[row * 3 + 1] * b[3 + col] + a[row * 3 + 2] * b[6 + col])
    }
  }
  return out as unknown as Mat3
}

export function mulVec(m: Mat3, v: Vec3): Vec3 {
  return {
    x: m[0] * v.x + m[1] * v.y + m[2] * v.z,
    y: m[3] * v.x + m[4] * v.y + m[5] * v.z,
    z: m[6] * v.x + m[7] * v.y + m[8] * v.z,
  }
}

export function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }
}

export function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }
}

export function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x }
}

export function length(v: Vec3): number {
  return Math.hypot(v.x, v.y, v.z)
}

/** Transformação rígida: `p_pai = rot · p_filho + pos`. */
export interface Transform {
  readonly rot: Mat3
  readonly pos: Vec3
}

export const IDENTITY_TRANSFORM: Transform = { rot: IDENTITY, pos: { x: 0, y: 0, z: 0 } }

/** `parent ∘ child`: leva um ponto do referencial do filho ao do pai do pai. */
export function compose(parent: Transform, child: Transform): Transform {
  return { rot: mulMat(parent.rot, child.rot), pos: add(parent.pos, mulVec(parent.rot, child.pos)) }
}

export function applyTransform(t: Transform, p: Vec3): Vec3 {
  return add(t.pos, mulVec(t.rot, p))
}

/** Caixa orientada: centro, três eixos unitários ortogonais e meias-medidas ao longo deles. */
export interface Obb {
  readonly center: Vec3
  readonly axes: readonly [Vec3, Vec3, Vec3]
  readonly half: Vec3
}

/** Caixa com `center` e `half` no referencial de `frame`, levada ao referencial de cima. */
export function obbFromFrame(frame: Transform, center: Vec3, half: Vec3): Obb {
  const r = frame.rot
  return {
    center: applyTransform(frame, center),
    axes: [
      { x: r[0], y: r[3], z: r[6] },
      { x: r[1], y: r[4], z: r[7] },
      { x: r[2], y: r[5], z: r[8] },
    ],
    half,
  }
}

/** Folga numérica: sobreposição menor que isto (m) conta como encosto, não como colisão. */
export const OVERLAP_EPSILON_M = 1e-6

const PARALLEL_EPSILON = 1e-9

function halfOf(obb: Obb): readonly [number, number, number] {
  return [obb.half.x, obb.half.y, obb.half.z]
}

/** Raio da projeção da caixa sobre o eixo unitário `axis`. */
function projectionRadius(obb: Obb, axis: Vec3): number {
  const half = halfOf(obb)
  let radius = 0
  for (let i = 0; i < 3; i++) radius += half[i] * Math.abs(dot(obb.axes[i], axis))
  return radius
}

/**
 * As duas caixas se sobrepõem? SAT com os 15 eixos (3 + 3 + 9 produtos vetoriais). Encosto (sobreposição
 * até `OVERLAP_EPSILON_M`) não conta.
 */
export function obbOverlap(a: Obb, b: Obb): boolean {
  const delta = sub(b.center, a.center)
  const axes: Vec3[] = [...a.axes, ...b.axes]
  for (const u of a.axes) {
    for (const v of b.axes) {
      const c = cross(u, v)
      const size = length(c)
      if (size > PARALLEL_EPSILON) axes.push({ x: c.x / size, y: c.y / size, z: c.z / size })
    }
  }
  for (const axis of axes) {
    const overlap =
      projectionRadius(a, axis) + projectionRadius(b, axis) - Math.abs(dot(delta, axis))
    if (overlap <= OVERLAP_EPSILON_M) return false
  }
  return true
}

/** O segmento de `from` a `to` atravessa a caixa? Método das lajes (slabs) no referencial da caixa. */
export function segmentIntersectsObb(from: Vec3, to: Vec3, obb: Obb): boolean {
  const origin = sub(from, obb.center)
  const direction = sub(to, from)
  const half = halfOf(obb)
  let tMin = 0
  let tMax = 1
  for (let i = 0; i < 3; i++) {
    const axis = obb.axes[i]
    const start = dot(origin, axis)
    const slope = dot(direction, axis)
    if (Math.abs(slope) < PARALLEL_EPSILON) {
      if (Math.abs(start) > half[i]) return false
      continue
    }
    let t1 = (-half[i] - start) / slope
    let t2 = (half[i] - start) / slope
    if (t1 > t2) [t1, t2] = [t2, t1]
    tMin = Math.max(tMin, t1)
    tMax = Math.min(tMax, t2)
    if (tMin > tMax) return false
  }
  return true
}

/** Pontos da superfície da caixa (grade em cada face, no máximo `maxPerAxis` por aresta), para amostrar o terreno. */
export function obbSurfacePoints(obb: Obb, stepM = 0.5, maxPerAxis = 12): Vec3[] {
  const half = halfOf(obb)
  const counts = half.map((h) => Math.min(maxPerAxis, Math.max(2, Math.ceil((2 * h) / stepM) + 1)))
  const points: Vec3[] = []
  for (let face = 0; face < 3; face++) {
    const u = (face + 1) % 3
    const v = (face + 2) % 3
    for (const sign of [-1, 1]) {
      for (let i = 0; i < counts[u]; i++) {
        for (let j = 0; j < counts[v]; j++) {
          const local = [0, 0, 0]
          local[face] = sign * half[face]
          local[u] = -half[u] + (2 * half[u] * i) / (counts[u] - 1)
          local[v] = -half[v] + (2 * half[v] * j) / (counts[v] - 1)
          points.push({
            x:
              obb.center.x +
              local[0] * obb.axes[0].x +
              local[1] * obb.axes[1].x +
              local[2] * obb.axes[2].x,
            y:
              obb.center.y +
              local[0] * obb.axes[0].y +
              local[1] * obb.axes[1].y +
              local[2] * obb.axes[2].y,
            z:
              obb.center.z +
              local[0] * obb.axes[0].z +
              local[1] * obb.axes[1].z +
              local[2] * obb.axes[2].z,
          })
        }
      }
    }
  }
  return points
}
