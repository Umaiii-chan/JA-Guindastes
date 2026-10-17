// Geometria das lingas: a ÚNICA fonte da altura das lingas no frontend (F-19; ADR-051). Sem Three.js.
//
// É a mesma conta de `backend/app/domain/services/rigging.py`; a paridade é provada por uma tabela de
// casos única (`backend/tests/fixtures/sling_geometry_cases.json`), lida pelos testes dos dois lados.
// O planejador (backend) e a cena (aqui) usam esta geometria: a altura das lingas do plano é a mesma
// que a cena desenha ao tocá-lo.
//
// Modelo (amarração em ponte): as lingas saem do ponto de suspensão (o fim do gancho ou da cadeia de
// acessórios) e prendem nos cantos do topo da carga.
//   r  = alcance horizontal até o canto mais afastado (meia-diagonal da pegada; no tandem, a da metade
//        da carga que cada guindaste ergue);
//   α  = ângulo da linga com a HORIZONTAL (ASME B30.9);
//   L  = r / cos α;  queda = r · tan α (do ponto de suspensão ao topo da carga).
// Padrão α = 60°; se a linga passar de 8 m, α = 45°; se ainda passar, o aparelho real pediria balancim.

/** Ângulo padrão da linga com a horizontal. */
export const PREFERRED_ANGLE_DEG = 60
/** Ângulo do padrão quando a linga a 60° ficaria longa demais (também o mínimo recomendado). */
export const FALLBACK_ANGLE_DEG = 45
/** Abaixo disto o ASME B30.9 proíbe usar a linga. */
export const MIN_ALLOWED_ANGLE_DEG = 30
/** Perto de 90° a queda r·tan α explode: o teto é 85°. */
export const MAX_ALLOWED_ANGLE_DEG = 85
/** Comprimento a partir do qual o padrão abandona os 60°. */
export const MAX_PREFERRED_LENGTH_M = 8
/** Piso da altura das lingas: o gancho não encosta no topo da carga. */
export const MIN_DROP_M = 0.3

const EPS = 1e-9

/** As lingas de uma carga: alcance horizontal, comprimento, ângulo com a horizontal e altura. */
export interface SlingGeometry {
  readonly reachM: number
  readonly lengthM: number
  readonly angleDeg: number
  readonly dropM: number
}

/** Medida ou ângulo que não descreve uma linga. */
export class InvalidSlingGeometryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidSlingGeometryError'
  }
}

function positive(name: string, value: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new InvalidSlingGeometryError(`${name} deve ser um número finito`)
  }
  if (value <= 0) throw new InvalidSlingGeometryError(`${name} deve ser maior que zero`)
  return value
}

const RAD = Math.PI / 180

/** Ângulo válido (30° a 90°), ou `InvalidSlingGeometryError`. */
export function checkAngleDeg(angleDeg: number): number {
  const value = positive('o ângulo da linga', angleDeg)
  if (value < MIN_ALLOWED_ANGLE_DEG - EPS || value > MAX_ALLOWED_ANGLE_DEG + EPS) {
    throw new InvalidSlingGeometryError(
      `o ângulo da linga deve ficar entre ${MIN_ALLOWED_ANGLE_DEG}° e ${MAX_ALLOWED_ANGLE_DEG}° com a horizontal`,
    )
  }
  return value
}

/** Ângulo abaixo do mínimo recomendado (45°): tensão alta, só em atenção. */
export function belowRecommendedAngle(geometry: SlingGeometry): boolean {
  return geometry.angleDeg < FALLBACK_ANGLE_DEG - EPS
}

/** A linga passa do comprimento preferido mesmo a 45°: o aparelho real usaria balancim. */
export function needsSpreader(geometry: SlingGeometry): boolean {
  return geometry.lengthM > MAX_PREFERRED_LENGTH_M + EPS
}

/** Alcance horizontal do ponto de suspensão ao canto mais afastado da pegada. */
export function reachM(lengthM: number, widthM: number, tandem = false): number {
  const length = positive('o comprimento da carga', lengthM)
  const width = positive('a largura da carga', widthM)
  const along = tandem ? length / 4 : length / 2
  return Math.hypot(along, width / 2)
}

/** Lingas com o alcance `reach` e o ângulo `angleDeg`. */
export function fromAngle(reach: number, angleDeg: number): SlingGeometry {
  const r = positive('o alcance horizontal', reach)
  const alpha = checkAngleDeg(angleDeg)
  const natural = r * Math.tan(alpha * RAD)
  if (natural >= MIN_DROP_M) {
    return { reachM: r, lengthM: r / Math.cos(alpha * RAD), angleDeg: alpha, dropM: natural }
  }
  // Piso da queda: o ângulo efetivo sobe um pouco (carga pequena com linga a 30°-45°).
  return {
    reachM: r,
    lengthM: Math.hypot(r, MIN_DROP_M),
    angleDeg: Math.atan2(MIN_DROP_M, r) / RAD,
    dropM: MIN_DROP_M,
  }
}

/** Lingas com o alcance `reach` e o comprimento `lengthM`: `α = acos(r / L)`. */
export function fromLength(reach: number, lengthM: number): SlingGeometry {
  const r = positive('o alcance horizontal', reach)
  const length = positive('o comprimento da linga', lengthM)
  if (length <= r) {
    throw new InvalidSlingGeometryError('a linga é mais curta que o alcance horizontal até o canto')
  }
  checkAngleDeg(Math.acos(r / length) / RAD)
  const drop = Math.max(MIN_DROP_M, Math.sqrt(length * length - r * r))
  return {
    reachM: r,
    lengthM: Math.hypot(r, drop),
    angleDeg: Math.atan2(drop, r) / RAD,
    dropM: drop,
  }
}

export interface DefaultGeometryOptions {
  /** Ângulo informado (30° a 90°); ausente, o padrão (60°; 45° se a linga ficaria longa). */
  readonly angleDeg?: number | null
  /** Tandem: cada guindaste ergue a sua metade (içamento a 1/4 e 3/4; ADR-041). */
  readonly tandem?: boolean
}

/** As lingas da carga `lengthM × widthM`: a conta que o planejador, o tandem e a cena usam. */
export function defaultGeometry(
  lengthM: number,
  widthM: number,
  options: DefaultGeometryOptions = {},
): SlingGeometry {
  const reach = reachM(lengthM, widthM, options.tandem ?? false)
  if (options.angleDeg !== undefined && options.angleDeg !== null) {
    return fromAngle(reach, options.angleDeg)
  }
  const preferred = fromAngle(reach, PREFERRED_ANGLE_DEG)
  return preferred.lengthM <= MAX_PREFERRED_LENGTH_M + EPS
    ? preferred
    : fromAngle(reach, FALLBACK_ANGLE_DEG)
}

/** Altura das lingas (m) entre o ponto de suspensão e o topo da carga. */
export function slingDropOf(
  lengthM: number,
  widthM: number,
  options: DefaultGeometryOptions = {},
): number {
  return defaultGeometry(lengthM, widthM, options).dropM
}
