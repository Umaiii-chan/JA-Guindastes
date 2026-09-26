import { Group, Matrix4, Object3D, PropertyBinding, Quaternion, Vector3 } from 'three'

import {
  type CraneGeometryParameters,
  validateCraneGeometryParameters,
} from '../../domain/geometry/operationalGeometry'
import type { CraneRig } from './CraneController'

// Mapeamento cinemático configurável (`CraneKinematics` da doc-fonte § 10.2): liga os nós de um
// modelo 3D (GLB/glTF, ADR-008) aos papéis que o `CraneController` movimenta, valida a hierarquia e
// confere a calibração do asset contra a ficha técnica (doc-fonte § 12; ADR-013 C-4, regras 3 e 4).
//
// O asset NUNCA é fonte de dado de cálculo (RN-003; ADR-013 C-4, regra 1; C-7): a, h e o comprimento
// da lança recolhida entram pela configuração (ficha técnica no backend; FICTÍCIOS até ela existir,
// ADR-012). A posição dos nós só é comparada com eles, e uma divergência é aviso de calibração (erro
// só visual), não erro de mapeamento.

/**
 * Papéis do simulador. Correspondem aos nomes da doc-fonte § 10.2: `turret`, `boom`,
 * `boomExtension` (`boom_extension`), `boomTip` (`boom_tip`), `cable` e `hook`, mais `base` e
 * `cableLine`, que o `CraneRig` também usa.
 */
export type CraneKinematicRole = keyof CraneKinematicsNodeNames

/**
 * Papel → nome do nó no asset. Os nomes são comparados depois do mesmo saneamento que o GLTFLoader
 * aplica (`PropertyBinding.sanitizeNodeName`: espaços viram `_`; `[ ] . : /` são removidos), então
 * podem ser escritos como estão no arquivo.
 */
export interface CraneKinematicsNodeNames {
  /** Torre: gira em torno do seu Y local (eixo de giro). Obrigatório. */
  readonly turret: string
  /** Lança: origem no pino do pé da lança P; inclina em torno do seu X local. Obrigatório. */
  readonly boom: string
  /** Ponta da lança T (eixo da polia). Obrigatório. */
  readonly boomTip: string
  /** Pivô do cabo, na ponta; o controller o mantém na vertical. Obrigatório. */
  readonly cable: string
  /** Ponto de suspensão G; filho do cabo. Obrigatório. */
  readonly hook: string
  /** Chassi, referencial do guindaste (origem O). Se ausente, usa-se a raiz do asset. */
  readonly base?: string
  /**
   * Seção telescópica que desliza no +Z da lança. Se ausente (lança fixa), um nó vazio é sintetizado
   * entre a lança e a ponta; nesse caso a faixa de comprimento da lança deve ser fixa.
   */
  readonly boomExtension?: string
  /** Linha do cabo com altura 1 e topo na origem, escalada no Y. Se ausente, sintetiza-se nó vazio. */
  readonly cableLine?: string
}

export const REQUIRED_KINEMATIC_ROLES = ['turret', 'boom', 'boomTip', 'cable', 'hook'] as const
export const OPTIONAL_KINEMATIC_ROLES = ['base', 'boomExtension', 'cableLine'] as const

export interface CraneKinematicsCalibrationTolerance {
  /** Desvio máximo aceito entre a posição de um nó e o ponto esperado (m). */
  readonly positionM: number
  /** Desvio máximo aceito da rotação de repouso de um nó em relação à base (°). */
  readonly rotationDeg: number
}

export interface CraneKinematicsConfig {
  readonly nodeNames: CraneKinematicsNodeNames
  /** a e h da ficha técnica (ADR-013 C-4), os mesmos que o `CraneController` recebe. */
  readonly geometryParameters: CraneGeometryParameters
  /** Lança toda recolhida, L_min da ficha técnica (m); vira `CraneRig.boomRetractedLengthM`. */
  readonly boomRetractedLengthM: number
  /**
   * Tolerâncias da conferência de calibração. Não há valor padrão: a tolerância de engenharia
   * aceitável ainda não foi definida (ADR-013, pergunta G-7).
   */
  readonly calibrationTolerance: CraneKinematicsCalibrationTolerance
}

export interface MapCraneKinematicsOptions {
  /**
   * Nomes dos nós como estão no arquivo (`LoadedGltf.sourceNodeNames`). O GLTFLoader renomeia nós
   * repetidos (`nome_1`); com esta lista, nomes repetidos no arquivo também são denunciados.
   */
  readonly sourceNodeNames?: readonly string[]
}

/** Problema que impede montar o rig. */
export type CraneKinematicsError =
  | {
      readonly kind: 'missing-node'
      readonly role: CraneKinematicRole
      readonly nodeName: string
      readonly message: string
    }
  | {
      readonly kind: 'duplicate-node'
      readonly role: CraneKinematicRole
      readonly nodeName: string
      readonly count: number
      readonly message: string
    }
  | {
      readonly kind: 'invalid-hierarchy'
      readonly role: CraneKinematicRole
      readonly nodeName: string
      readonly expectedAncestorRole: CraneKinematicRole
      readonly message: string
    }
  | { readonly kind: 'invalid-config'; readonly message: string }

/** Pontos conferidos na pose de repouso (ψ = 0, θ = 0, lança recolhida), no referencial da base. */
export type CalibrationPoint =
  /** A torre fica sobre o eixo de giro (x = z = 0). */
  | 'turret-on-slewing-axis'
  /** P = (0, h, a). */
  | 'boom-pivot'
  /** T = (0, h, a + L_min). */
  | 'boom-tip'
  /** A extensão em repouso está recolhida (z local = 0). */
  | 'extension-retracted'
  /** O pivô do cabo fica em T. */
  | 'cable-at-tip'
  /** O gancho fica na vertical de T (x e z de T). */
  | 'hook-below-tip'

/** Divergência entre o asset e a ficha técnica. Não impede montar o rig: o erro é só visual. */
export type CraneKinematicsWarning =
  | {
      readonly kind: 'position'
      readonly point: CalibrationPoint
      readonly expected: readonly [number, number, number]
      readonly actual: readonly [number, number, number]
      readonly deviationM: number
      readonly message: string
    }
  | {
      readonly kind: 'rest-rotation'
      readonly role: CraneKinematicRole
      readonly angleDeg: number
      readonly message: string
    }
  | {
      readonly kind: 'scale'
      readonly role: CraneKinematicRole
      readonly scale: readonly [number, number, number]
      readonly message: string
    }
  | {
      readonly kind: 'unit'
      readonly measuredRetractedLengthM: number
      readonly expectedRetractedLengthM: number
      readonly ratio: number
      readonly likelyUnit: 'milímetro' | 'centímetro'
      readonly message: string
    }

export interface CraneKinematicsReport {
  readonly errors: readonly CraneKinematicsError[]
  /** Avisos de calibração; só são calculados quando não há erro. */
  readonly warnings: readonly CraneKinematicsWarning[]
  /** Papéis opcionais ausentes no asset e sintetizados como nós vazios. */
  readonly synthesizedRoles: readonly CraneKinematicRole[]
}

export type CraneKinematicsResult =
  | { readonly ok: true; readonly rig: CraneRig; readonly report: CraneKinematicsReport }
  | { readonly ok: false; readonly report: CraneKinematicsReport }

/** Papel → papel do qual ele precisa descender (hierarquia que o `CraneController` pressupõe). */
const PARENT_ROLE: Readonly<Partial<Record<CraneKinematicRole, CraneKinematicRole>>> = {
  turret: 'base',
  boom: 'turret',
  boomExtension: 'boom',
  boomTip: 'boomExtension',
  cable: 'boomTip',
  hook: 'cable',
  cableLine: 'cable',
}

const ROLE_ORDER: readonly CraneKinematicRole[] = [
  'base',
  'turret',
  'boom',
  'boomExtension',
  'boomTip',
  'cable',
  'cableLine',
  'hook',
]

/** Razões medido/esperado que indicam asset exportado em outra unidade (tolerância de 2 %). */
const UNIT_HINTS = [
  { ratio: 1000, unit: 'milímetro' },
  { ratio: 100, unit: 'centímetro' },
] as const
const UNIT_HINT_RELATIVE_TOLERANCE = 0.02

/**
 * Localiza os nós configurados em `assetRoot`, valida os obrigatórios e a hierarquia e, se estiver
 * tudo certo, monta o `CraneRig` que o `CraneController` comanda e confere a calibração.
 *
 * Nunca lança por problema do asset: tudo vai no relatório. Para montar o rig pode alterar a cena
 * (nós sintetizados de papéis opcionais ausentes, ver `CraneKinematicsNodeNames`).
 */
export function mapCraneKinematics(
  assetRoot: Object3D,
  config: CraneKinematicsConfig,
  options: MapCraneKinematicsOptions = {},
): CraneKinematicsResult {
  const configErrors = validateConfig(config)
  if (configErrors.length > 0) {
    return { ok: false, report: { errors: configErrors, warnings: [], synthesizedRoles: [] } }
  }

  const errors: CraneKinematicsError[] = []
  const found: Partial<Record<CraneKinematicRole, Object3D>> = {}
  const sourceCounts = countNames(options.sourceNodeNames ?? [])

  for (const role of ROLE_ORDER) {
    const configuredName = config.nodeNames[role]
    if (configuredName === undefined || configuredName.trim() === '') {
      if (isRequiredRole(role)) {
        errors.push({
          kind: 'missing-node',
          role,
          nodeName: '',
          message: `Papel obrigatório ${role} sem nome de nó no mapeamento.`,
        })
      }
      continue
    }
    const nodeName = PropertyBinding.sanitizeNodeName(configuredName)
    const matches: Object3D[] = []
    assetRoot.traverse((object) => {
      if (object.name === nodeName) matches.push(object)
    })
    const count = Math.max(matches.length, sourceCounts.get(nodeName) ?? 0)
    if (matches.length === 0) {
      errors.push({
        kind: 'missing-node',
        role,
        nodeName,
        message: `Nó "${nodeName}" (papel ${role}) não encontrado no modelo 3D.`,
      })
    } else if (count > 1) {
      errors.push({
        kind: 'duplicate-node',
        role,
        nodeName,
        count,
        message: `Nó "${nodeName}" (papel ${role}) aparece ${count} vezes no modelo 3D; o nome precisa ser único.`,
      })
    } else {
      found[role] = matches[0]
    }
  }
  if (found.base === undefined && !config.nodeNames.base?.trim()) {
    found.base = assetRoot
  }

  if (errors.length === 0) {
    for (const role of ROLE_ORDER) {
      const node = found[role]
      const ancestorRole = nearestMappedAncestorRole(role, found)
      if (node === undefined || ancestorRole === undefined) continue
      if (!isStrictDescendant(node, found[ancestorRole]!)) {
        errors.push({
          kind: 'invalid-hierarchy',
          role,
          nodeName: node.name,
          expectedAncestorRole: ancestorRole,
          message: `Nó "${node.name}" (papel ${role}) precisa estar abaixo do nó do papel ${ancestorRole} na hierarquia.`,
        })
      }
    }
  }
  if (errors.length > 0) {
    return { ok: false, report: { errors, warnings: [], synthesizedRoles: [] } }
  }

  const base = found.base!
  const turret = found.turret!
  const boom = found.boom!
  const boomTip = found.boomTip!
  const cable = found.cable!
  const hook = found.hook!
  const synthesizedRoles: CraneKinematicRole[] = []

  // As medições são da pose do asset como veio, antes de qualquer nó sintetizado.
  assetRoot.updateWorldMatrix(true, true)
  const warnings = checkCalibration(assetRoot, found, config)

  let boomExtension = found.boomExtension
  if (boomExtension === undefined) {
    boomExtension = new Group()
    boomExtension.name = `${boom.name}__extensao_sintetizada`
    boom.add(boomExtension)
    boomExtension.updateWorldMatrix(true, false)
    // `attach` preserva a pose de mundo da ponta ao pendurá-la na extensão (identidade na lança).
    boomExtension.attach(boomTip)
    synthesizedRoles.push('boomExtension')
  }
  let cableLine = found.cableLine
  if (cableLine === undefined) {
    cableLine = new Object3D()
    cableLine.name = `${cable.name}__linha_sintetizada`
    cable.add(cableLine)
    synthesizedRoles.push('cableLine')
  }

  return {
    ok: true,
    rig: {
      base,
      turret,
      boom,
      boomExtension,
      boomTip,
      cable,
      cableLine,
      hook,
      boomRetractedLengthM: config.boomRetractedLengthM,
    },
    report: { errors: [], warnings, synthesizedRoles },
  }
}

function validateConfig(config: CraneKinematicsConfig): CraneKinematicsError[] {
  const errors: CraneKinematicsError[] = []
  try {
    validateCraneGeometryParameters(config.geometryParameters)
  } catch (error) {
    errors.push({ kind: 'invalid-config', message: (error as Error).message })
  }
  if (!(Number.isFinite(config.boomRetractedLengthM) && config.boomRetractedLengthM > 0)) {
    errors.push({
      kind: 'invalid-config',
      message: `boomRetractedLengthM precisa ser um número finito maior que zero (recebido ${config.boomRetractedLengthM}).`,
    })
  }
  const { positionM, rotationDeg } = config.calibrationTolerance
  if (!(Number.isFinite(positionM) && positionM >= 0)) {
    errors.push({
      kind: 'invalid-config',
      message: `calibrationTolerance.positionM precisa ser finito e ≥ 0 (recebido ${positionM}).`,
    })
  }
  if (!(Number.isFinite(rotationDeg) && rotationDeg >= 0)) {
    errors.push({
      kind: 'invalid-config',
      message: `calibrationTolerance.rotationDeg precisa ser finito e ≥ 0 (recebido ${rotationDeg}).`,
    })
  }
  return errors
}

function isRequiredRole(role: CraneKinematicRole): boolean {
  return (REQUIRED_KINEMATIC_ROLES as readonly CraneKinematicRole[]).includes(role)
}

function countNames(names: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1)
  return counts
}

function nearestMappedAncestorRole(
  role: CraneKinematicRole,
  found: Partial<Record<CraneKinematicRole, Object3D>>,
): CraneKinematicRole | undefined {
  let ancestor = PARENT_ROLE[role]
  while (ancestor !== undefined && found[ancestor] === undefined) {
    ancestor = PARENT_ROLE[ancestor]
  }
  return ancestor
}

function isStrictDescendant(node: Object3D, ancestor: Object3D): boolean {
  let current = node.parent
  while (current !== null) {
    if (current === ancestor) return true
    current = current.parent
  }
  return false
}

type Xyz = readonly [number, number, number]

/** Matriz de `node` no referencial de `frame` (os dois com `matrixWorld` atualizada). */
function relativeMatrix(node: Object3D, frame: Object3D): Matrix4 {
  return new Matrix4().copy(frame.matrixWorld).invert().multiply(node.matrixWorld)
}

function decompose(matrix: Matrix4): { position: Vector3; rotation: Quaternion; scale: Vector3 } {
  const position = new Vector3()
  const rotation = new Quaternion()
  const scale = new Vector3()
  matrix.decompose(position, rotation, scale)
  return { position, rotation, scale }
}

function checkCalibration(
  assetRoot: Object3D,
  found: Partial<Record<CraneKinematicRole, Object3D>>,
  config: CraneKinematicsConfig,
): CraneKinematicsWarning[] {
  const warnings: CraneKinematicsWarning[] = []
  const { positionM: tolM, rotationDeg: tolDeg } = config.calibrationTolerance
  const { boomPivotOffsetM: a, boomPivotHeightM: h } = config.geometryParameters
  const retracted = config.boomRetractedLengthM
  const base = found.base!

  // Escala: do asset até cada nó móvel, sem escala (a unidade do glTF é o metro). A escala é aceita
  // se o erro que ela causa ao longo da lança recolhida (|s − 1| · L_min) cabe na tolerância.
  for (const role of ROLE_ORDER) {
    const node = found[role]
    if (node === undefined || role === 'cableLine') continue
    const { scale } = decompose(relativeMatrix(node, assetRoot))
    const worst = Math.max(...scale.toArray().map((s) => Math.abs(s - 1)))
    if (worst * retracted > tolM) {
      const values: Xyz = scale.toArray()
      warnings.push({
        kind: 'scale',
        role,
        scale: values,
        message: `Nó "${node.name}" (papel ${role}) tem escala ${formatXyz(values)} em relação à raiz do asset; esperado 1 (metros, sem escala).`,
      })
    }
  }

  // Rotação de repouso: o controller escreve rotation.y da torre e rotation.x da lança e do cabo, e
  // pressupõe a pose de repouso do ADR-013 C-4, regra 4 (todos os eixos alinhados com os da base).
  for (const role of ROLE_ORDER) {
    const node = found[role]
    if (node === undefined || role === 'base' || role === 'cableLine') continue
    const { rotation } = decompose(relativeMatrix(node, base))
    const angleDeg = (2 * Math.acos(Math.min(1, Math.abs(rotation.w))) * 180) / Math.PI
    if (angleDeg > tolDeg) {
      warnings.push({
        kind: 'rest-rotation',
        role,
        angleDeg,
        message: `Nó "${node.name}" (papel ${role}) está girado ${angleDeg.toFixed(3)}° em relação à base na pose de repouso; esperado 0° (ADR-013 C-4, regra 4).`,
      })
    }
  }

  const at = (node: Object3D): Vector3 => decompose(relativeMatrix(node, base)).position
  const turretAt = at(found.turret!)
  const pivotAt = at(found.boom!)
  const tipAt = at(found.boomTip!)
  const cableAt = at(found.cable!)
  const hookAt = at(found.hook!)

  const position = (
    point: CalibrationPoint,
    expected: Xyz,
    actual: Xyz,
    deviationM: number,
    what: string,
  ): void => {
    if (deviationM > tolM) {
      warnings.push({
        kind: 'position',
        point,
        expected,
        actual,
        deviationM,
        message: `${what}: esperado ${formatXyz(expected)} m, encontrado ${formatXyz(actual)} m (desvio ${deviationM.toFixed(6)} m).`,
      })
    }
  }

  position(
    'turret-on-slewing-axis',
    [0, turretAt.y, 0],
    turretAt.toArray(),
    Math.hypot(turretAt.x, turretAt.z),
    'Torre fora do eixo de giro',
  )
  const expectedPivot: Xyz = [0, h, a]
  position(
    'boom-pivot',
    expectedPivot,
    pivotAt.toArray(),
    pivotAt.distanceTo(new Vector3(...expectedPivot)),
    'Pino da lança P fora de (0, h, a)',
  )
  const expectedTip: Xyz = [0, h, a + retracted]
  position(
    'boom-tip',
    expectedTip,
    tipAt.toArray(),
    tipAt.distanceTo(new Vector3(...expectedTip)),
    'Ponta da lança T fora de (0, h, a + L_min)',
  )
  if (found.boomExtension !== undefined) {
    const z = found.boomExtension.position.z
    position(
      'extension-retracted',
      [found.boomExtension.position.x, found.boomExtension.position.y, 0],
      found.boomExtension.position.toArray(),
      Math.abs(z),
      'Extensão da lança não está recolhida (z local ≠ 0) na pose de repouso',
    )
  }
  position(
    'cable-at-tip',
    tipAt.toArray(),
    cableAt.toArray(),
    cableAt.distanceTo(tipAt),
    'Pivô do cabo fora da ponta da lança T',
  )
  position(
    'hook-below-tip',
    [tipAt.x, hookAt.y, tipAt.z],
    hookAt.toArray(),
    Math.hypot(hookAt.x - tipAt.x, hookAt.z - tipAt.z),
    'Gancho fora da vertical da ponta da lança T',
  )

  // Unidade: lança recolhida medida no asset × L_min da ficha técnica.
  const measured = tipAt.distanceTo(pivotAt)
  const ratio = measured / retracted
  for (const hint of UNIT_HINTS) {
    if (Math.abs(ratio / hint.ratio - 1) <= UNIT_HINT_RELATIVE_TOLERANCE) {
      warnings.push({
        kind: 'unit',
        measuredRetractedLengthM: measured,
        expectedRetractedLengthM: retracted,
        ratio,
        likelyUnit: hint.unit,
        message: `A lança recolhida mede ${measured.toFixed(3)} no asset e ${retracted} m na ficha técnica (razão ${ratio.toFixed(1)}): o modelo parece estar em ${hint.unit}; o glTF usa metros.`,
      })
    }
  }

  return warnings
}

function formatXyz(values: Xyz): string {
  return `(${values.map((value) => value.toFixed(3)).join(', ')})`
}
