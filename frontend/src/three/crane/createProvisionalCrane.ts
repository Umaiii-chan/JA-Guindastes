import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  type Material,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
  TorusGeometry,
} from 'three'

import type { CraneRig } from './CraneController'
import type { CraneLimits, CraneState } from './types'

// Guindaste PROVISÓRIO, montado com caixas e cilindros, só para a PoC visual: o modelo 3D real
// (GLB, ADR-008) ainda não existe (L-002). Todas as medidas e limites abaixo são FICTÍCIOS: não
// descrevem nenhum guindaste real e não servem para cálculo (ADR-012, dados fictícios rotulados).

/** Nomes estáveis dos nós, imitando o mapeamento de nós que o GLB real vai precisar (doc-fonte § 12.1). */
export const CRANE_NODE_NAMES = {
  base: 'crane-base',
  turret: 'crane-turret',
  boom: 'crane-boom',
  boomExtension: 'crane-boom-extension',
  boomTip: 'crane-boom-tip',
  cable: 'crane-cable',
  cableLine: 'crane-cable-line',
  hook: 'crane-hook',
} as const

export interface ProvisionalCraneDimensions {
  /** Lança toda recolhida, do pivô até a ponta (m). */
  readonly boomRetractedLengthM: number
  /** Lança toda estendida (m); define o curso da única seção telescópica do modelo. */
  readonly boomExtendedLengthM: number
}

/** FICTÍCIO: dimensões do guindaste provisório. */
export const PROVISIONAL_CRANE_DIMENSIONS: ProvisionalCraneDimensions = {
  boomRetractedLengthM: 12,
  boomExtendedLengthM: 22,
}

/** FICTÍCIO: limites dos comandos na PoC; não são limites de nenhum guindaste real. */
export const PROVISIONAL_CRANE_LIMITS: CraneLimits = {
  turretRotationDeg: { min: -180, max: 180 },
  boomAngleDeg: { min: 0, max: 80 },
  boomLengthM: {
    min: PROVISIONAL_CRANE_DIMENSIONS.boomRetractedLengthM,
    max: PROVISIONAL_CRANE_DIMENSIONS.boomExtendedLengthM,
  },
  cableLengthM: { min: 1, max: 15 },
}

/** FICTÍCIO: pose inicial da PoC. */
export const PROVISIONAL_CRANE_INITIAL_STATE: CraneState = {
  turretRotationDeg: 0,
  boomAngleDeg: 35,
  boomLengthM: PROVISIONAL_CRANE_DIMENSIONS.boomRetractedLengthM,
  cableLengthM: 5,
}

// Medidas visuais (m), FICTÍCIAS.
const WHEEL_RADIUS = 0.55
const CHASSIS_TOP = 1.6
const TURRET_HEIGHT = 1.1
const BOOM_PIVOT = { y: 1.7, z: -1.2 }
const BOOM_SECTION = 0.9
const EXTENSION_SECTION = 0.65
/** Trecho da extensão que continua dentro da seção base com a lança toda estendida. */
const EXTENSION_OVERLAP = 1

/**
 * Monta o guindaste provisório na pose de repouso descrita em `CraneRig` e devolve seus nós.
 * O nó raiz é `rig.base`, com origem no chão, sob o eixo de giro da torre.
 */
export function createProvisionalCrane(
  dimensions: ProvisionalCraneDimensions = PROVISIONAL_CRANE_DIMENSIONS,
): CraneRig {
  const { boomRetractedLengthM: retracted, boomExtendedLengthM: extended } = dimensions
  if (!(retracted > 0) || !(extended >= retracted)) {
    throw new RangeError(
      `Dimensões da lança inválidas: recolhida ${retracted} m, estendida ${extended} m.`,
    )
  }

  const body = new MeshStandardMaterial({ color: 0xf2b705, roughness: 0.6, metalness: 0.1 })
  const dark = new MeshStandardMaterial({ color: 0x2f3337, roughness: 0.8 })
  const steel = new MeshStandardMaterial({ color: 0x9aa3ab, roughness: 0.4, metalness: 0.7 })

  const base = node(CRANE_NODE_NAMES.base)
  base.add(
    box([2.6, CHASSIS_TOP - WHEEL_RADIUS, 10], body, [0, (CHASSIS_TOP + WHEEL_RADIUS) / 2, 1.5]),
  )
  base.add(box([2.5, 1.2, 1.8], dark, [0, CHASSIS_TOP + 0.6, 5.5]))
  for (const z of [-2.2, -0.6, 3.6]) {
    for (const x of [-1.25, 1.25]) {
      base.add(wheel(dark, [x, WHEEL_RADIUS, z]))
    }
  }

  const turret = node(CRANE_NODE_NAMES.turret, [0, CHASSIS_TOP, 0])
  turret.add(box([2.4, TURRET_HEIGHT, 3.6], body, [0, TURRET_HEIGHT / 2, -0.4]))
  turret.add(box([2.4, 1.2, 1], dark, [0, 0.6, -2.7]))
  turret.add(box([0.9, 1.3, 1.6], dark, [1.4, 0.65, 0.6]))
  base.add(turret)

  const boom = node(CRANE_NODE_NAMES.boom, [0, BOOM_PIVOT.y, BOOM_PIVOT.z])
  // A seção base termina um pouco antes da ponta para a extensão aparecer mesmo recolhida.
  const boomSectionLength = retracted * 0.98
  boom.add(
    box([BOOM_SECTION, BOOM_SECTION, boomSectionLength], body, [0, 0, boomSectionLength / 2]),
  )
  turret.add(boom)

  const extensionLength = extended - retracted + EXTENSION_OVERLAP
  const boomExtension = node(CRANE_NODE_NAMES.boomExtension)
  boomExtension.add(
    box([EXTENSION_SECTION, EXTENSION_SECTION, extensionLength], body, [
      0,
      0,
      retracted - extensionLength / 2,
    ]),
  )
  boom.add(boomExtension)

  const boomTip = node(CRANE_NODE_NAMES.boomTip, [0, 0, retracted])
  const sheave = new Mesh(new CylinderGeometry(0.35, 0.35, 0.3, 20), dark)
  sheave.rotation.z = Math.PI / 2
  boomTip.add(sheave)
  boomExtension.add(boomTip)

  const cable = node(CRANE_NODE_NAMES.cable)
  const cableGeometry = new CylinderGeometry(0.03, 0.03, 1, 8)
  // Linha de altura 1 com o topo na origem: a escala no Y vira o comprimento do cabo.
  cableGeometry.translate(0, -0.5, 0)
  const cableLine = new Mesh(cableGeometry, steel)
  cableLine.name = CRANE_NODE_NAMES.cableLine
  cable.add(cableLine)
  boomTip.add(cable)

  const hook = node(CRANE_NODE_NAMES.hook)
  hook.add(box([0.5, 0.6, 0.3], body, [0, -0.3, 0]))
  const hookCurve = new Mesh(new TorusGeometry(0.2, 0.05, 8, 16, Math.PI * 1.5), steel)
  hookCurve.position.y = -0.85
  hook.add(hookCurve)
  cable.add(hook)

  return {
    base,
    turret,
    boom,
    boomExtension,
    boomTip,
    cable,
    cableLine,
    hook,
    boomRetractedLengthM: retracted,
  }
}

type Vec3 = readonly [number, number, number]

function node(name: string, position: Vec3 = [0, 0, 0]): Object3D {
  const group = new Group()
  group.name = name
  group.position.set(...position)
  return group
}

function box(size: Vec3, material: Material, position: Vec3): Mesh {
  const mesh = new Mesh(new BoxGeometry(...size), material)
  mesh.position.set(...position)
  return mesh
}

function wheel(material: Material, position: Vec3): Mesh {
  const mesh = new Mesh(new CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, 0.45, 20), material)
  mesh.rotation.z = Math.PI / 2
  mesh.position.set(...position)
  return mesh
}
