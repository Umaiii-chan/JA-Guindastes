// Ambiente da simulação (leva E; contrato em docs/leva-e/contratos.md): terreno descrito por
// parâmetros, obstáculos e a posição do guindaste. Funções puras, sem Three.js, usadas pelo editor de
// cenário (TASK-052), pelas colisões (TASK-053), pelas patolas (TASK-054) e pela gravação (TASK-057).
//
// Eixos da cena (ADR-013): Y para cima; X e Z no chão; o eixo de giro do guindaste em (0, 0) quando
// `crane` é o padrão. Unidades internas (RN-006): metros e graus.

/** Feição do terreno somada ao plano inclinado. */
export interface TerrainFeature {
  readonly id: string
  /**
   * - `mound` (elevação): cossenoide de altura `heightM` no centro, zero no raio;
   * - `pit` (depressão): a mesma forma, para baixo;
   * - `plateau` (platô): topo plano até 60 % do raio, descendo em cossenoide até o raio;
   * - `ramp` (rampa): retângulo de comprimento `2 × radiusM` na direção `directionDeg` e largura
   *   `widthM`, subindo de 0 a `heightM` no sentido da direção; zero fora dele;
   * - `flatten` (aplainar; TASK-066): leva o terreno já somado até o nível absoluto `heightM`, por
   *   inteiro até 60 % do raio e caindo em cossenoide até o raio. Vale na ordem da lista: só mexe no
   *   que as feições anteriores e o plano inclinado produziram.
   */
  readonly kind: 'mound' | 'pit' | 'plateau' | 'ramp' | 'flatten'
  readonly centerX: number
  readonly centerZ: number
  readonly radiusM: number
  /** Sempre >= 0; o sinal vem do tipo (`pit` desce). Em `flatten` é o nível absoluto (pode ser < 0). */
  readonly heightM: number
  /** Só `ramp`: direção da subida, em graus a partir de +X, anti-horário visto de cima. */
  readonly directionDeg?: number
  /** Só `ramp`: largura; padrão = `radiusM`. */
  readonly widthM?: number
}

/** Terreno: plano inclinado (% = subida em m a cada 100 m) mais feições. */
export interface TerrainSpec {
  readonly slopeXPercent: number
  readonly slopeZPercent: number
  readonly features: readonly TerrainFeature[]
}

export const FLAT_TERRAIN: TerrainSpec = { slopeXPercent: 0, slopeZPercent: 0, features: [] }

/** Obstáculo apoiado no terreno (base na altura do terreno no centro). */
export interface Obstacle {
  readonly id: string
  readonly label: string
  /** `cylinder` usa `widthM` como diâmetro e ignora `depthM` e a rotação. */
  readonly kind: 'box' | 'cylinder'
  readonly centerX: number
  readonly centerZ: number
  readonly widthM: number
  readonly depthM: number
  readonly heightM: number
  readonly rotationYDeg: number
}

/** Posição do guindaste no cenário: eixo de giro em (x, z) e rumo do chassi (graus, de +X). */
export interface CranePlacement {
  readonly x: number
  readonly z: number
  readonly headingDeg: number
}

export const DEFAULT_CRANE_PLACEMENT: CranePlacement = { x: 0, z: 0, headingDeg: 0 }

/** Tipo de solo (TASK-066): rocha, compactado, argiloso ou aterro solto. */
export type SoilKind = 'rock' | 'compacted' | 'clay' | 'loose_fill'

export const SOIL_KINDS: readonly SoilKind[] = ['rock', 'compacted', 'clay', 'loose_fill']

/** Solo padrão fora das zonas pintadas. */
export const DEFAULT_SOIL: SoilKind = 'compacted'

/** Círculo de solo pintado no chão; a zona mais recente da lista vale onde houver sobreposição. */
export interface SoilZone {
  readonly id: string
  readonly kind: SoilKind
  readonly centerX: number
  readonly centerZ: number
  readonly radiusM: number
}

/** Vento: velocidade (m/s) e direção para onde sopra (graus a partir de +X, anti-horário visto de cima). */
export interface WindSpec {
  readonly speedMs: number
  readonly directionDeg: number
}

/** Ponto de coleta da carga no chão (TASK-073; contrato da leva F): posição e giro da carga em Y. */
export interface CargoPlacement {
  readonly x: number
  readonly z: number
  readonly rotationYDeg: number
}

/** Ponto de entrega da carga (TASK-073): posição, giro da carga e raio da área de entrega. */
export interface DeliveryPlacement {
  readonly x: number
  readonly z: number
  readonly rotationYDeg: number
  readonly radiusM: number
}

/** Cenário completo, como é salvo (TASK-052) e copiado na gravação (TASK-057). */
export interface ScenarioSpec {
  readonly terrain: TerrainSpec
  readonly obstacles: readonly Obstacle[]
  readonly crane: CranePlacement
  /** Zonas de solo pintadas (TASK-066); ausente = tudo `compacted`. */
  readonly soilZones?: readonly SoilZone[]
  /** Vento (TASK-066); ausente = sem vento. */
  readonly wind?: WindSpec
  /** Coleta da carga (TASK-073); ausente = sem ponto marcado. */
  readonly cargo?: CargoPlacement
  /** Entrega da carga (TASK-073); ausente = sem ponto marcado. */
  readonly delivery?: DeliveryPlacement
}

export const EMPTY_SCENARIO: ScenarioSpec = {
  terrain: FLAT_TERRAIN,
  obstacles: [],
  crane: DEFAULT_CRANE_PLACEMENT,
}

const DEG = Math.PI / 180
const PLATEAU_TOP = 0.6

function cosineBump(distance: number, radius: number): number {
  if (radius <= 0 || distance >= radius) return 0
  return (1 + Math.cos((Math.PI * distance) / radius)) / 2
}

/** Peso 0..1 do platô: 1 até 60 % do raio, descendo em cossenoide até o raio. */
function plateauWeight(distance: number, radius: number): number {
  const top = radius * PLATEAU_TOP
  if (distance <= top) return 1
  return cosineBump(distance - top, radius - top)
}

function featureHeight(feature: TerrainFeature, x: number, z: number): number {
  const dx = x - feature.centerX
  const dz = z - feature.centerZ
  const height = Math.max(0, feature.heightM)
  switch (feature.kind) {
    case 'mound':
      return height * cosineBump(Math.hypot(dx, dz), feature.radiusM)
    case 'pit':
      return -height * cosineBump(Math.hypot(dx, dz), feature.radiusM)
    case 'plateau':
      return height * plateauWeight(Math.hypot(dx, dz), feature.radiusM)
    case 'flatten':
      // Tratado em `terrainHeightAt` (não é aditivo).
      return 0
    case 'ramp': {
      const angle = (feature.directionDeg ?? 0) * DEG
      const along = dx * Math.cos(angle) - dz * Math.sin(angle)
      const across = dx * Math.sin(angle) + dz * Math.cos(angle)
      const halfWidth = (feature.widthM ?? feature.radiusM) / 2
      if (feature.radiusM <= 0 || Math.abs(along) > feature.radiusM || Math.abs(across) > halfWidth)
        return 0
      return (height * (along + feature.radiusM)) / (2 * feature.radiusM)
    }
  }
}

/** Altura do terreno (m) no ponto (x, z) do chão. */
export function terrainHeightAt(spec: TerrainSpec, x: number, z: number): number {
  let height = (spec.slopeXPercent / 100) * x + (spec.slopeZPercent / 100) * z
  for (const feature of spec.features) {
    if (feature.kind === 'flatten') {
      const weight = plateauWeight(
        Math.hypot(x - feature.centerX, z - feature.centerZ),
        feature.radiusM,
      )
      height += (feature.heightM - height) * weight
    } else {
      height += featureHeight(feature, x, z)
    }
  }
  return height
}

/**
 * Inclinação do terreno (graus) em (x, z), pela diferença central com passo `stepM`. É a inclinação
 * do plano tangente, sem sinal.
 */
export function terrainSlopeDegAt(spec: TerrainSpec, x: number, z: number, stepM = 0.5): number {
  const gx =
    (terrainHeightAt(spec, x + stepM, z) - terrainHeightAt(spec, x - stepM, z)) / (2 * stepM)
  const gz =
    (terrainHeightAt(spec, x, z + stepM) - terrainHeightAt(spec, x, z - stepM)) / (2 * stepM)
  return Math.atan(Math.hypot(gx, gz)) / DEG
}

/**
 * Inclinação média do terreno sob uma base retangular (as quatro sapatas das patolas, por exemplo):
 * plano pelos cantos, em graus. `halfLengthM` ao longo do rumo, `halfWidthM` na transversal.
 */
export function terrainSlopeUnderFootprintDeg(
  spec: TerrainSpec,
  placement: CranePlacement,
  halfLengthM: number,
  halfWidthM: number,
): number {
  const angle = placement.headingDeg * DEG
  const corner = (along: number, across: number) => {
    const x = placement.x + along * Math.cos(angle) + across * Math.sin(angle)
    const z = placement.z - along * Math.sin(angle) + across * Math.cos(angle)
    return terrainHeightAt(spec, x, z)
  }
  const frontLeft = corner(halfLengthM, -halfWidthM)
  const frontRight = corner(halfLengthM, halfWidthM)
  const rearLeft = corner(-halfLengthM, -halfWidthM)
  const rearRight = corner(-halfLengthM, halfWidthM)
  const gradAlong = (frontLeft + frontRight - rearLeft - rearRight) / 2 / (2 * halfLengthM)
  const gradAcross = (frontRight + rearRight - frontLeft - rearLeft) / 2 / (2 * halfWidthM)
  return Math.atan(Math.hypot(gradAlong, gradAcross)) / DEG
}

/** Solo no ponto (x, z): a zona pintada mais recente que o contém, senão `compacted` (TASK-066). */
export function soilAt(spec: ScenarioSpec, x: number, z: number): SoilKind {
  const zones = spec.soilZones ?? []
  for (let index = zones.length - 1; index >= 0; index -= 1) {
    const zone = zones[index]
    if (zone && Math.hypot(x - zone.centerX, z - zone.centerZ) <= zone.radiusM) return zone.kind
  }
  return DEFAULT_SOIL
}
