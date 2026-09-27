import { type Object3D, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import { CraneController } from '../../../src/three/crane/CraneController'
import {
  type CraneKinematicsConfig,
  type CraneKinematicsNodeNames,
  type CraneKinematicsResult,
  mapCraneKinematics,
} from '../../../src/three/crane/craneKinematics'
import {
  CRANE_NODE_NAMES,
  createProvisionalCrane,
  PROVISIONAL_CRANE_DIMENSIONS,
  PROVISIONAL_CRANE_GEOMETRY,
  PROVISIONAL_CRANE_LIMITS,
} from '../../../src/three/crane/createProvisionalCrane'
import type { CraneLimits, CraneState } from '../../../src/three/crane/types'
import { type LoadedGltf, parseGltf } from '../../../src/three/loaders/loadGltf'
import { expectXyzClose, xyz, type Xyz } from '../../helpers/expectClose'
import { readExampleGlb } from '../../helpers/exampleModel'

// Mapeamento cinemático sobre o GLB de exemplo FICTÍCIO (guindaste provisório exportado; ADR-012).
// a, h e L_min entram pela configuração (ficha técnica; aqui os FICTÍCIOS da PoC), nunca do GLB
// (RN-003; ADR-013 C-4, regra 1).

/**
 * Tolerâncias só para erro de ponto flutuante: as transformações dos nós ficam no JSON do GLB com
 * precisão dupla. As mesmas da TASK-016; não são tolerâncias de engenharia (G-7).
 */
const SCENE_TOLERANCE_M = 1e-6
const CONFIG: CraneKinematicsConfig = {
  nodeNames: CRANE_NODE_NAMES,
  geometryParameters: PROVISIONAL_CRANE_GEOMETRY,
  boomRetractedLengthM: PROVISIONAL_CRANE_DIMENSIONS.boomRetractedLengthM,
  calibrationTolerance: { positionM: SCENE_TOLERANCE_M, rotationDeg: 1e-6 },
}

async function loadExample(): Promise<LoadedGltf> {
  return parseGltf(readExampleGlb())
}

async function mapExample(
  config: CraneKinematicsConfig = CONFIG,
  edit?: (scene: Object3D) => void,
): Promise<CraneKinematicsResult> {
  const loaded = await loadExample()
  edit?.(loaded.scene)
  return mapCraneKinematics(loaded.scene, config, { sourceNodeNames: loaded.sourceNodeNames })
}

function withNodeNames(nodeNames: Partial<CraneKinematicsNodeNames>): CraneKinematicsConfig {
  return { ...CONFIG, nodeNames: { ...CRANE_NODE_NAMES, ...nodeNames } }
}

function worldXyz(object: Object3D): Xyz {
  object.updateWorldMatrix(true, false)
  return object.getWorldPosition(new Vector3()).toArray()
}

function statesWithin(limits: CraneLimits): CraneState[] {
  const { turretRotationDeg: psi, boomAngleDeg: theta } = limits
  const { boomLengthM: length, cableLengthM: cable } = limits
  const states: CraneState[] = []
  for (const turretRotationDeg of [psi.min, -90, 0, 45, 120, psi.max]) {
    for (const boomAngleDeg of [theta.min, 35, theta.max]) {
      for (const boomLengthM of [length.min, (length.min + length.max) / 2, length.max]) {
        for (const cableLengthM of [cable.min, 5, cable.max]) {
          states.push({ turretRotationDeg, boomAngleDeg, boomLengthM, cableLengthM })
        }
      }
    }
  }
  return states
}

function expectRigMatchesGeometry(
  rig: Extract<CraneKinematicsResult, { ok: true }>['rig'],
  limits: CraneLimits,
): void {
  const crane = new CraneController(rig, limits, PROVISIONAL_CRANE_GEOMETRY)
  for (const state of statesWithin(limits)) {
    crane.setTurretRotation(state.turretRotationDeg)
    crane.setBoomAngle(state.boomAngleDeg)
    crane.setBoomLength(state.boomLengthM)
    crane.setCableLength(state.cableLengthM)
    const geometry = crane.getOperationalGeometry()
    const label = JSON.stringify(state)

    expectXyzClose(worldXyz(rig.hook), xyz(geometry.hook), SCENE_TOLERANCE_M, `G ${label}`)
    expectXyzClose(worldXyz(rig.boomTip), xyz(geometry.boomTip), SCENE_TOLERANCE_M, `T ${label}`)
    expectXyzClose(worldXyz(rig.boom), xyz(geometry.boomPivot), SCENE_TOLERANCE_M, `P ${label}`)
  }
}

describe('mapCraneKinematics sobre o GLB de exemplo FICTÍCIO', () => {
  it('localiza todos os nós, sem erros, avisos nem nós sintetizados', async () => {
    const result = await mapExample()

    expect(result.report).toEqual({ errors: [], warnings: [], synthesizedRoles: [] })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.rig.base.name).toBe(CRANE_NODE_NAMES.base)
    expect(result.rig.turret.name).toBe(CRANE_NODE_NAMES.turret)
    expect(result.rig.boom.name).toBe(CRANE_NODE_NAMES.boom)
    expect(result.rig.boomExtension.name).toBe(CRANE_NODE_NAMES.boomExtension)
    expect(result.rig.boomTip.name).toBe(CRANE_NODE_NAMES.boomTip)
    expect(result.rig.cable.name).toBe(CRANE_NODE_NAMES.cable)
    expect(result.rig.cableLine.name).toBe(CRANE_NODE_NAMES.cableLine)
    expect(result.rig.hook.name).toBe(CRANE_NODE_NAMES.hook)
    expect(result.rig.boomRetractedLengthM).toBe(CONFIG.boomRetractedLengthM)
  })

  it('o CraneController comanda o rig importado e o gancho fica em G (ADR-013) em todos os estados', async () => {
    const result = await mapExample()
    if (!result.ok) throw new Error(JSON.stringify(result.report))

    expectRigMatchesGeometry(result.rig, PROVISIONAL_CRANE_LIMITS)
  })

  it('o rig importado coincide, nó a nó, com o guindaste provisório no mesmo estado', async () => {
    const result = await mapExample()
    if (!result.ok) throw new Error(JSON.stringify(result.report))
    const state: CraneState = {
      turretRotationDeg: 73,
      boomAngleDeg: 41,
      boomLengthM: 17.5,
      cableLengthM: 6.2,
    }
    const imported = result.rig
    const provisional = createProvisionalCrane()
    new CraneController(imported, PROVISIONAL_CRANE_LIMITS, PROVISIONAL_CRANE_GEOMETRY, state)
    new CraneController(provisional, PROVISIONAL_CRANE_LIMITS, PROVISIONAL_CRANE_GEOMETRY, state)

    for (const role of ['turret', 'boom', 'boomExtension', 'boomTip', 'cable', 'hook'] as const) {
      expectXyzClose(worldXyz(imported[role]), worldXyz(provisional[role]), SCENE_TOLERANCE_M, role)
    }
  })

  describe('erros de mapeamento (relatório, sem exceção)', () => {
    it('denuncia o nó obrigatório ausente', async () => {
      const result = await mapExample(withNodeNames({ hook: 'gancho-que-nao-existe' }))

      expect(result.ok).toBe(false)
      expect(result.report.errors).toEqual([
        expect.objectContaining({
          kind: 'missing-node',
          role: 'hook',
          nodeName: 'gancho-que-nao-existe',
        }),
      ])
      expect(result.report.errors[0].message).toContain('gancho-que-nao-existe')
    })

    it('denuncia vários nós ausentes de uma vez, inclusive papel obrigatório sem nome', async () => {
      const result = await mapExample(withNodeNames({ turret: 'x', boom: 'y', cable: '  ' }))

      expect(result.ok).toBe(false)
      expect(result.report.errors.map((error) => ('role' in error ? error.role : ''))).toEqual([
        'turret',
        'boom',
        'cable',
      ])
      expect(result.report.errors.every((error) => error.kind === 'missing-node')).toBe(true)
    })

    it('denuncia nó opcional configurado e ausente', async () => {
      const result = await mapExample(withNodeNames({ boomExtension: 'extensao-inexistente' }))

      expect(result.ok).toBe(false)
      expect(result.report.errors).toEqual([
        expect.objectContaining({ kind: 'missing-node', role: 'boomExtension' }),
      ])
    })

    it('denuncia nome repetido no arquivo, mesmo com o GLTFLoader renomeando o repetido', async () => {
      const loaded = await loadExample()
      const sourceNodeNames = [...loaded.sourceNodeNames, CRANE_NODE_NAMES.boom]

      const result = mapCraneKinematics(loaded.scene, CONFIG, { sourceNodeNames })

      expect(result.ok).toBe(false)
      expect(result.report.errors).toEqual([
        expect.objectContaining({ kind: 'duplicate-node', role: 'boom', count: 2 }),
      ])
    })

    it('denuncia nome repetido na cena', async () => {
      const result = await mapExample(CONFIG, (scene) => {
        const copy = scene.getObjectByName(CRANE_NODE_NAMES.hook)!.clone()
        scene.add(copy)
      })

      expect(result.ok).toBe(false)
      expect(result.report.errors).toEqual([
        expect.objectContaining({ kind: 'duplicate-node', role: 'hook', count: 2 }),
      ])
    })

    it('denuncia hierarquia que o controller não consegue comandar', async () => {
      const result = await mapExample(CONFIG, (scene) => {
        // Gancho pendurado direto no chassi: não acompanharia o cabo.
        scene
          .getObjectByName(CRANE_NODE_NAMES.base)!
          .add(scene.getObjectByName(CRANE_NODE_NAMES.hook)!)
      })

      expect(result.ok).toBe(false)
      expect(result.report.errors).toEqual([
        expect.objectContaining({
          kind: 'invalid-hierarchy',
          role: 'hook',
          expectedAncestorRole: 'cable',
        }),
      ])
    })

    it('denuncia dois papéis apontando para o mesmo nó', async () => {
      const result = await mapExample(withNodeNames({ cable: CRANE_NODE_NAMES.boomTip }))

      expect(result.ok).toBe(false)
      expect(result.report.errors).toContainEqual(
        expect.objectContaining({ kind: 'invalid-hierarchy', role: 'cable' }),
      )
    })

    it.each([
      ['L_min zero', { boomRetractedLengthM: 0 }],
      ['h negativo', { geometryParameters: { boomPivotOffsetM: 0, boomPivotHeightM: -1 } }],
      ['tolerância não finita', { calibrationTolerance: { positionM: NaN, rotationDeg: 0 } }],
    ])('denuncia configuração inválida (%s)', async (_label, override) => {
      const result = await mapExample({ ...CONFIG, ...override })

      expect(result.ok).toBe(false)
      expect(result.report.errors).toEqual([expect.objectContaining({ kind: 'invalid-config' })])
    })
  })

  describe('papéis opcionais ausentes', () => {
    it('sem base, usa a raiz do asset; sem extensão e sem linha do cabo, sintetiza nós vazios', async () => {
      const nodeNames: CraneKinematicsNodeNames = {
        turret: CRANE_NODE_NAMES.turret,
        boom: CRANE_NODE_NAMES.boom,
        boomTip: CRANE_NODE_NAMES.boomTip,
        cable: CRANE_NODE_NAMES.cable,
        hook: CRANE_NODE_NAMES.hook,
      }
      const loaded = await loadExample()

      const result = mapCraneKinematics(
        loaded.scene,
        { ...CONFIG, nodeNames },
        { sourceNodeNames: loaded.sourceNodeNames },
      )

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.report.errors).toEqual([])
      expect(result.report.warnings).toEqual([])
      expect(result.report.synthesizedRoles).toEqual(['boomExtension', 'cableLine'])
      expect(result.rig.base).toBe(loaded.scene)
      expect(result.rig.boomExtension.parent).toBe(result.rig.boom)
      expect(result.rig.boomTip.parent).toBe(result.rig.boomExtension)
      expect(result.rig.cableLine.parent).toBe(result.rig.cable)
      // Lança fixa: a faixa de comprimento fica em L_min (FICTÍCIO).
      const L = PROVISIONAL_CRANE_DIMENSIONS.boomRetractedLengthM
      expectRigMatchesGeometry(result.rig, {
        ...PROVISIONAL_CRANE_LIMITS,
        boomLengthM: { min: L, max: L },
      })
    })
  })

  describe('calibração contra a ficha técnica (avisos: erro só visual, ADR-013 C-4, regra 3)', () => {
    it('avisa quando P e T do asset não batem com a e h da ficha técnica, mas monta o rig', async () => {
      const result = await mapExample({
        ...CONFIG,
        geometryParameters: { boomPivotOffsetM: -1.56, boomPivotHeightM: 3.5 },
      })

      expect(result.ok).toBe(true)
      expect(result.report.warnings).toEqual([
        expect.objectContaining({
          kind: 'position',
          point: 'boom-pivot',
          expected: [0, 3.5, -1.56],
        }),
        expect.objectContaining({ kind: 'position', point: 'boom-tip' }),
      ])
      const pivot = result.report.warnings[0]
      expect(pivot.kind === 'position' && pivot.deviationM).toBeCloseTo(0.2, 9)
    })

    it('avisa quando L_min da ficha técnica difere da lança recolhida do asset', async () => {
      const result = await mapExample({ ...CONFIG, boomRetractedLengthM: 12.5 })

      expect(result.report.warnings).toEqual([
        expect.objectContaining({ kind: 'position', point: 'boom-tip' }),
      ])
    })

    it('avisa escala diferente de 1 nos nós (o glTF usa metros)', async () => {
      const result = await mapExample(CONFIG, (scene) => {
        scene.getObjectByName(CRANE_NODE_NAMES.boom)!.scale.setScalar(1.5)
      })

      expect(result.ok).toBe(true)
      const scaled = result.report.warnings.filter((warning) => warning.kind === 'scale')
      expect(scaled.map((warning) => warning.kind === 'scale' && warning.role)).toEqual([
        'boom',
        'boomExtension',
        'boomTip',
        'cable',
        'hook',
      ])
    })

    it('reconhece um asset em milímetros', () => {
      // FICTÍCIO: o mesmo guindaste provisório, com todas as medidas da lança em milímetros.
      const rig = createProvisionalCrane(
        { boomRetractedLengthM: 12000, boomExtendedLengthM: 22000 },
        { boomPivotOffsetM: -1200, boomPivotHeightM: 3300 },
      )

      const result = mapCraneKinematics(rig.base, CONFIG)

      expect(result.ok).toBe(true)
      expect(result.report.warnings).toContainEqual(
        expect.objectContaining({ kind: 'unit', likelyUnit: 'milímetro' }),
      )
    })

    it('avisa pose de repouso girada (lança inclinada no arquivo)', async () => {
      const result = await mapExample(CONFIG, (scene) => {
        scene.getObjectByName(CRANE_NODE_NAMES.boom)!.rotation.x = -0.1
      })

      expect(result.ok).toBe(true)
      expect(result.report.warnings).toContainEqual(
        expect.objectContaining({ kind: 'rest-rotation', role: 'boom' }),
      )
      const boom = result.report.warnings.find(
        (warning) => warning.kind === 'rest-rotation' && warning.role === 'boom',
      )
      expect(boom?.kind === 'rest-rotation' && boom.angleDeg).toBeCloseTo((0.1 * 180) / Math.PI, 6)
    })

    it('avisa extensão fora da posição recolhida, cabo fora da ponta e gancho fora da vertical', async () => {
      const result = await mapExample(CONFIG, (scene) => {
        scene.getObjectByName(CRANE_NODE_NAMES.boomExtension)!.position.z = 2
        scene.getObjectByName(CRANE_NODE_NAMES.cable)!.position.y = 0.5
        scene.getObjectByName(CRANE_NODE_NAMES.hook)!.position.x = 0.3
      })

      const points = result.report.warnings.map((warning) =>
        warning.kind === 'position' ? warning.point : warning.kind,
      )
      expect(points).toEqual(['boom-tip', 'extension-retracted', 'cable-at-tip', 'hook-below-tip'])
    })

    it('não lê a geometria de cálculo do asset: o controller usa a e h recebidos', async () => {
      const result = await mapExample({
        ...CONFIG,
        geometryParameters: { boomPivotOffsetM: 0, boomPivotHeightM: 5 },
      })
      if (!result.ok) throw new Error(JSON.stringify(result.report))

      const crane = new CraneController(result.rig, PROVISIONAL_CRANE_LIMITS, {
        boomPivotOffsetM: 0,
        boomPivotHeightM: 5,
      })

      expect(crane.getOperationalGeometry().boomPivot).toEqual({ xM: 0, yM: 5, zM: 0 })
      expect(result.report.warnings.length).toBeGreaterThan(0)
    })
  })
})
