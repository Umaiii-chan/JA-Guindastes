/// <reference types="node" />
import { createHash } from 'node:crypto'
import { statSync } from 'node:fs'

import { Box3, type Object3D, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import { CraneController } from '../../../src/three/crane/CraneController'
import {
  OUTRIGGER_POSITIONS,
  OutriggerController,
  outriggerNodeName,
} from '../../../src/three/crane/OutriggerController'
import type { CraneKinematicsConfig } from '../../../src/three/crane/craneKinematics'
import { CRANE_NODE_NAMES } from '../../../src/three/crane/createProvisionalCrane'
import {
  PROVISIONAL_CRANE_GEOMETRY,
  PROVISIONAL_CRANE_LIMITS,
} from '../../../src/three/crane/provisionalCraneSpec'
import type { CraneState } from '../../../src/three/crane/types'
import {
  loadTruckCraneModel,
  type LoadedTruckCraneModel,
  mapTruckCraneKinematics,
  parseTruckCraneModel,
  TRUCK_CRANE_LUFFING_NODE_NAMES,
  TRUCK_CRANE_MODEL_MEASUREMENTS,
  TRUCK_CRANE_MODEL_URL,
  TRUCK_CRANE_NODE_NAMES,
  TRUCK_CRANE_OUTRIGGER_TRAVEL_M,
} from '../../../src/three/loaders/loadTruckCraneModel'
import {
  CRANE_GLB_PATH,
  readCraneGlbBytes,
  readCraneGlbWithoutTextures,
} from '../../helpers/craneGlb'
import { expectClose, expectXyzClose, xyz, type Xyz } from '../../helpers/expectClose'

// GLB ILUSTRATIVO do guindaste sobre caminhão (TASK-043), gerado por
// scripts/convert-crane-80t.mjs e versionado em public/models/. a, h e L_min entram pela
// configuração (aqui, a ficha FICTÍCIA de demo), nunca do GLB (RN-003; ADR-013 C-4, regra 1).

/** Tolerâncias de ponto flutuante: as malhas e os nós ficam em float32/float64 no GLB. */
const SCENE_TOLERANCE_M = 1e-4
const TIGHT_CALIBRATION = { positionM: 1e-3, rotationDeg: 1e-3 }

/**
 * SHA-256 do GLB versionado: é o que `node scripts/convert-crane-80t.mjs` gera (determinístico).
 * Mudou o script? Regenere o GLB e atualize este valor e o handoff da TASK-064.
 */
const GLB_SHA256 = 'bae4cadae0a84774f10ac6a2f6fa6c2a13dcb673db8a005514cc50d4a558bb1e'

/**
 * Ficha FICTÍCIA de demonstração do backend (`backend/app/demo_seed.py`: a = −1,56 m, ADR-031, h = 3,3 m, L_min = 12 m; ADR-012).
 */
const DEMO_CONFIG: Omit<CraneKinematicsConfig, 'nodeNames'> = {
  geometryParameters: { boomPivotOffsetM: 0.46, boomPivotHeightM: 3.3 },
  boomRetractedLengthM: 12,
  calibrationTolerance: TIGHT_CALIBRATION,
}

/**
 * Padrão FICTÍCIO do frontend sem ficha (`PROVISIONAL_CRANE_GEOMETRY`), alinhado à ficha de demo
 * (a = −1,56 m) na TASK-041.
 */
const FRONTEND_DEFAULT_CONFIG: Omit<CraneKinematicsConfig, 'nodeNames'> = {
  ...DEMO_CONFIG,
  geometryParameters: PROVISIONAL_CRANE_GEOMETRY,
}

/** Configuração com as medidas do próprio modelo: a conferência não pode dar aviso nenhum. */
const MODEL_CONFIG: Omit<CraneKinematicsConfig, 'nodeNames'> = {
  geometryParameters: {
    boomPivotOffsetM: TRUCK_CRANE_MODEL_MEASUREMENTS.boomPivotOffsetM,
    boomPivotHeightM: TRUCK_CRANE_MODEL_MEASUREMENTS.boomPivotHeightM,
  },
  boomRetractedLengthM: TRUCK_CRANE_MODEL_MEASUREMENTS.boomRetractedLengthM,
  calibrationTolerance: TIGHT_CALIBRATION,
}

const GLB = await readCraneGlbWithoutTextures()

function readGlb(): ArrayBuffer {
  return GLB.slice(0)
}

async function loadModel(): Promise<LoadedTruckCraneModel> {
  return parseTruckCraneModel(readGlb())
}

function worldXyz(object: Object3D): Xyz {
  return object.getWorldPosition(new Vector3()).toArray()
}

describe('GLB do guindaste 80 t (public/models, TASK-064)', () => {
  it('é um GLB 2.0 de tamanho razoável para web (< 6 MB)', () => {
    const header = new DataView(readCraneGlbBytes().buffer.slice(0, 12))

    expect(header.getUint32(0, true)).toBe(0x46546c67) // "glTF"
    expect(header.getUint32(4, true)).toBe(2)
    expect(statSync(CRANE_GLB_PATH).size).toBeLessThan(6_000_000)
  })

  it('é o arquivo que o script de conversão gera (SHA-256 fixo)', () => {
    const sha = createHash('sha256').update(readCraneGlbBytes()).digest('hex')

    expect(sha).toBe(GLB_SHA256)
  })

  it('usa os mesmos nomes de nós do guindaste provisório, cada um uma vez no arquivo', async () => {
    const model = await loadModel()

    expect(model.nodeNames).toEqual(CRANE_NODE_NAMES)
    const names = [
      ...Object.values(TRUCK_CRANE_NODE_NAMES),
      ...Object.values(TRUCK_CRANE_LUFFING_NODE_NAMES),
    ]
    for (const name of names) {
      expect(model.gltf.sourceNodeNames.filter((nodeName) => nodeName === name)).toHaveLength(1)
    }
  })

  it('traz a fonte (CC BY 4.0) e o aviso de modelo ilustrativo nos extras do nó base', async () => {
    const model = await loadModel()
    const base = model.scene.getObjectByName(TRUCK_CRANE_NODE_NAMES.base)!

    expect(base.parent).toBe(model.scene)
    expect(base.userData).toMatchObject({
      aviso: expect.stringContaining('MODELO ILUSTRATIVO'),
      fonte: { autor: 'awilliams1337', licenca: 'CC BY 4.0' },
      medidasDoModelo: {
        ...TRUCK_CRANE_MODEL_MEASUREMENTS,
        outriggerTravelM: TRUCK_CRANE_OUTRIGGER_TRAVEL_M,
      },
    })
  })

  it('o mapeamento aceita a hierarquia, sem erros nem nós sintetizados', async () => {
    const model = await loadModel()
    const result = mapTruckCraneKinematics(model, DEMO_CONFIG)

    expect(result.report.errors).toEqual([])
    expect(result.report.synthesizedRoles).toEqual([])
    expect(result.ok).toBe(true)
  })

  it('com as medidas do próprio modelo, a pose de repouso passa na conferência sem aviso', async () => {
    const result = mapTruckCraneKinematics(await loadModel(), MODEL_CONFIG)

    expect(result.report).toEqual({ errors: [], warnings: [], synthesizedRoles: [] })
  })

  it('com a ficha de demo (a = −1,56 m), a pose de repouso passa na conferência com 1 mm, sem aviso', async () => {
    const result = mapTruckCraneKinematics(await loadModel(), DEMO_CONFIG)

    expect(result.report).toEqual({ errors: [], warnings: [], synthesizedRoles: [] })
  })

  it('com o padrão do frontend (a = −1,56 m), a pose de repouso passa sem aviso', async () => {
    const result = mapTruckCraneKinematics(await loadModel(), FRONTEND_DEFAULT_CONFIG)

    expect(PROVISIONAL_CRANE_GEOMETRY).toEqual(DEMO_CONFIG.geometryParameters)
    expect(result.report).toEqual({ errors: [], warnings: [], synthesizedRoles: [] })
  })

  it('o CraneController comanda o rig: o gancho fica em G e na vertical da ponta', async () => {
    const result = mapTruckCraneKinematics(await loadModel(), MODEL_CONFIG)
    if (!result.ok) throw new Error(JSON.stringify(result.report))
    const crane = new CraneController(
      result.rig,
      PROVISIONAL_CRANE_LIMITS,
      MODEL_CONFIG.geometryParameters,
    )
    const states: CraneState[] = [
      { turretRotationDeg: 0, boomAngleDeg: 0, boomLengthM: 12, cableLengthM: 1 },
      { turretRotationDeg: 90, boomAngleDeg: 0, boomLengthM: 12, cableLengthM: 1 },
      { turretRotationDeg: 0, boomAngleDeg: 45, boomLengthM: 12, cableLengthM: 3 },
      { turretRotationDeg: -135, boomAngleDeg: 45, boomLengthM: 22, cableLengthM: 3 },
      { turretRotationDeg: 30, boomAngleDeg: 80, boomLengthM: 17, cableLengthM: 15 },
    ]
    for (const state of states) {
      crane.setTurretRotation(state.turretRotationDeg)
      crane.setBoomAngle(state.boomAngleDeg)
      crane.setBoomLength(state.boomLengthM)
      crane.setCableLength(state.cableLengthM)
      const geometry = crane.getOperationalGeometry()
      const label = JSON.stringify(state)
      const tip = worldXyz(result.rig.boomTip)
      const hook = worldXyz(result.rig.hook)

      expectXyzClose(
        worldXyz(result.rig.boom),
        xyz(geometry.boomPivot),
        SCENE_TOLERANCE_M,
        `P ${label}`,
      )
      expectXyzClose(tip, xyz(geometry.boomTip), SCENE_TOLERANCE_M, `T ${label}`)
      expectXyzClose(hook, xyz(geometry.hook), SCENE_TOLERANCE_M, `G ${label}`)
      expectXyzClose(
        [hook[0], 0, hook[2]],
        [tip[0], 0, tip[2]],
        SCENE_TOLERANCE_M,
        `vertical ${label}`,
      )
    }
  })

  it('updateLuffingCylinder aponta a camisa e a haste do cilindro uma para a outra', async () => {
    const model = await loadModel()
    const result = mapTruckCraneKinematics(model, MODEL_CONFIG)
    if (!result.ok) throw new Error(JSON.stringify(result.report))
    const crane = new CraneController(
      result.rig,
      PROVISIONAL_CRANE_LIMITS,
      MODEL_CONFIG.geometryParameters,
    )
    const cylinder = model.scene.getObjectByName(TRUCK_CRANE_LUFFING_NODE_NAMES.cylinder)!
    const rod = model.scene.getObjectByName(TRUCK_CRANE_LUFFING_NODE_NAMES.rod)!
    const axisPointsAt = (from: Object3D, to: Object3D): number => {
      const origin = from.getWorldPosition(new Vector3())
      const axis = new Vector3(0, 1, 0).transformDirection(from.matrixWorld)
      return axis.dot(to.getWorldPosition(new Vector3()).sub(origin).normalize())
    }

    for (const boomAngleDeg of [0, 30, 60, 80]) {
      crane.setTurretRotation(boomAngleDeg - 45)
      crane.setBoomAngle(boomAngleDeg)
      model.updateLuffingCylinder()
      model.scene.updateMatrixWorld(true)

      // cos ≥ 1 − 1e-6: menos de 0,1° de desvio. Os centros dos pinos diferem menos de 1 mm em X
      // (malha do GLB) e o nó só gira em X, então o alinhamento não é exato.
      expectClose(axisPointsAt(cylinder, rod), 1, 1e-6, `camisa θ=${boomAngleDeg}`)
      expectClose(axisPointsAt(rod, cylinder), 1, 1e-6, `haste θ=${boomAngleDeg}`)
    }
  })

  it('traz os 12 nós das patolas (viga, macaco e sapata nas 4 posições), cada um uma vez', async () => {
    const model = await loadModel()

    for (const position of OUTRIGGER_POSITIONS) {
      for (const part of ['beam', 'jack', 'pad'] as const) {
        const name = outriggerNodeName(position, part)
        expect(model.gltf.sourceNodeNames.filter((nodeName) => nodeName === name)).toHaveLength(1)
      }
    }
  })

  it('as patolas estendem para os lados e os macacos descem até o chão', async () => {
    const model = await loadModel()
    const base = model.scene.getObjectByName(TRUCK_CRANE_NODE_NAMES.base)!
    const outriggers = new OutriggerController({
      getRoot: () => base,
      invalidate: () => undefined,
      beamTravelM: TRUCK_CRANE_OUTRIGGER_TRAVEL_M,
      reducedMotion: true,
    })
    const padFor = (position: 'fl' | 'fr') =>
      model.scene.getObjectByName(outriggerNodeName(position, 'pad'))!
    model.scene.updateMatrixWorld(true)
    const restLeft = new Box3().setFromObject(padFor('fl'))
    const restRight = new Box3().setFromObject(padFor('fr'))
    expect(restLeft.min.y).toBeGreaterThan(0.3) // macacos suspensos em repouso

    outriggers.setState({ extensionPercent: 100, jacksSet: true, levelingDeg: 0 })
    model.scene.updateMatrixWorld(true)
    const left = new Box3().setFromObject(padFor('fl'))
    const right = new Box3().setFromObject(padFor('fr'))

    expectClose(left.min.x - restLeft.min.x, TRUCK_CRANE_OUTRIGGER_TRAVEL_M, 1e-3, 'esquerda +X')
    expectClose(right.min.x - restRight.min.x, -TRUCK_CRANE_OUTRIGGER_TRAVEL_M, 1e-3, 'direita −X')
    expectClose(left.min.y, 0, 1e-3, 'sapata no chão')
    expect(outriggers.isReady()).toBe(true)
  })

  it('updateTelescope espalha as seções 2 e 3 entre a seção 1 e a 4 conforme o comprimento', async () => {
    const model = await loadModel()
    const result = mapTruckCraneKinematics(model, MODEL_CONFIG)
    if (!result.ok) throw new Error(JSON.stringify(result.report))
    const crane = new CraneController(
      result.rig,
      PROVISIONAL_CRANE_LIMITS,
      MODEL_CONFIG.geometryParameters,
    )
    const section = (k: number) => model.scene.getObjectByName(`crane-boom-section-0${k}`)!
    const alongBoom = (node: Object3D) =>
      node.getWorldPosition(new Vector3()).sub(result.rig.boom.getWorldPosition(new Vector3())).z

    for (const length of [12, 17, 22]) {
      crane.setBoomLength(length)
      model.updateTelescope()
      model.scene.updateMatrixWorld(true)
      const stroke = alongBoom(section(4))
      expect(stroke).toBeGreaterThan(length - 12) // a seção 4 anda o curso inteiro (+ folga do repouso)
      expectClose(alongBoom(section(2)), stroke / 3, 1e-6, `seção 2, L=${length}`)
      expectClose(alongBoom(section(3)), (2 * stroke) / 3, 1e-6, `seção 3, L=${length}`)
    }
  })

  it('loadTruckCraneModel baixa o GLB da URL pública com o fetch recebido', async () => {
    const requested: string[] = []
    const fakeFetch = (async (url: string) => {
      requested.push(url)
      return new Response(readGlb(), { status: 200 })
    }) as typeof fetch

    const model = await loadTruckCraneModel(undefined, { fetch: fakeFetch })

    expect(requested).toEqual([TRUCK_CRANE_MODEL_URL])
    expect(TRUCK_CRANE_MODEL_URL).toMatch(/models\/guindaste-80t\.glb$/)
    expect(model.scene.getObjectByName(TRUCK_CRANE_NODE_NAMES.hook)).toBeDefined()
  })
})
