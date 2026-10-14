/// <reference types="node" />
import { createHash } from 'node:crypto'
import { readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { type Object3D, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import { CraneController } from '../../../src/three/crane/CraneController'
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
} from '../../../src/three/loaders/loadTruckCraneModel'
import { expectClose, expectXyzClose, xyz, type Xyz } from '../../helpers/expectClose'

// GLB ILUSTRATIVO do guindaste sobre caminhão (TASK-043), gerado por
// scripts/convert-crane-model.mjs e versionado em public/models/. a, h e L_min entram pela
// configuração (aqui, a ficha FICTÍCIA de demo), nunca do GLB (RN-003; ADR-013 C-4, regra 1).

const GLB_PATH = fileURLToPath(
  new URL('../../../public/models/guindaste-caminhao.glb', import.meta.url),
)

/** Tolerâncias de ponto flutuante: as malhas e os nós ficam em float32/float64 no GLB. */
const SCENE_TOLERANCE_M = 1e-4
const TIGHT_CALIBRATION = { positionM: 1e-3, rotationDeg: 1e-3 }

/**
 * SHA-256 do GLB versionado: é o que `node scripts/convert-crane-model.mjs` gera (determinístico).
 * Mudou o script? Regenere o GLB e atualize este valor e o handoff da TASK-043.
 */
const GLB_SHA256 = '637d7a1fa3966a9c19cdb15c3dd50c09bfc44cd99bcabf724823e3c570804936'

/**
 * Ficha FICTÍCIA de demonstração do backend (`backend/app/demo_seed.py`: a = −1,56 m desde a
 * TASK-043, h = 3,3 m, L_min = 12 m; ADR-012).
 */
const DEMO_CONFIG: Omit<CraneKinematicsConfig, 'nodeNames'> = {
  geometryParameters: { boomPivotOffsetM: -1.56, boomPivotHeightM: 3.3 },
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

function readGlb(): ArrayBuffer {
  const bytes = readFileSync(GLB_PATH)
  const copy = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(copy).set(bytes)
  return copy
}

async function loadModel(): Promise<LoadedTruckCraneModel> {
  return parseTruckCraneModel(readGlb())
}

function worldXyz(object: Object3D): Xyz {
  return object.getWorldPosition(new Vector3()).toArray()
}

describe('GLB do guindaste sobre caminhão (public/models, TASK-043)', () => {
  it('é um GLB 2.0 de tamanho razoável para web (< 3 MB)', () => {
    const header = new DataView(readGlb(), 0, 12)

    expect(header.getUint32(0, true)).toBe(0x46546c67) // "glTF"
    expect(header.getUint32(4, true)).toBe(2)
    expect(statSync(GLB_PATH).size).toBeLessThan(3_000_000)
  })

  it('é o arquivo que o script de conversão gera (SHA-256 fixo)', () => {
    const sha = createHash('sha256').update(readFileSync(GLB_PATH)).digest('hex')

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

  it('traz origem e aviso de modelo ilustrativo nos extras do nó base, com as medidas do modelo', async () => {
    const model = await loadModel()
    const base = model.scene.getObjectByName(TRUCK_CRANE_NODE_NAMES.base)!

    expect(base.parent).toBe(model.scene)
    expect(base.userData).toMatchObject({
      ficticio: true,
      ilustrativo: true,
      aviso: expect.stringContaining('MODELO ILUSTRATIVO'),
      origem: {
        arquivo: 'cgtrader_optimized_prop_crane.fbx',
        sha256: '81f0b6b4da654a83aa0575216e6a42b39eca3b6e148bdc496f584371380321a1',
        licenca: expect.stringContaining('permite versionar o GLB derivado'),
      },
      conversao: { script: 'frontend/scripts/convert-crane-model.mjs', tarefa: 'TASK-043' },
      medidasDoModelo: TRUCK_CRANE_MODEL_MEASUREMENTS,
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

    // O a do modelo é −1,5591 m: 0,9 mm da ficha, dentro da tolerância de 1 mm.
    expect(result.report).toEqual({ errors: [], warnings: [], synthesizedRoles: [] })
  })

  it('com o padrão do frontend (a = −1,56 m desde a TASK-041), a pose de repouso passa sem aviso', async () => {
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
      // (malha do FBX) e o nó só gira em X, então o alinhamento não é exato.
      expectClose(axisPointsAt(cylinder, rod), 1, 1e-6, `camisa θ=${boomAngleDeg}`)
      expectClose(axisPointsAt(rod, cylinder), 1, 1e-6, `haste θ=${boomAngleDeg}`)
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
    expect(TRUCK_CRANE_MODEL_URL).toMatch(/models\/guindaste-caminhao\.glb$/)
    expect(model.scene.getObjectByName(TRUCK_CRANE_NODE_NAMES.hook)).toBeDefined()
  })
})
