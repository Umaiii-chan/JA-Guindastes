// Sapatas do guindaste adicional no terreno (TASK-093; auditoria de 2026-10-16, F-25), com o GLB
// 80 t (TASK-064) lido do disco. Antes, a cena nunca passava a altura do terreno ao
// `OutriggerController`, e as sapatas desciam sempre até y = 0 da base: numa rampa, flutuavam de um
// lado e entravam no chão do outro. Terreno e posições FICTÍCIOS (ADR-012).
//
// Ambiente node (o helper do GLB lê o arquivo do disco); a etiqueta do guindaste só precisa de um
// elemento HTML qualquer, então o `document` é um mínimo de mentira.

import { Scene, Vector3 } from 'three'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import {
  type CranePlacement,
  type TerrainSpec,
  terrainHeightAt,
} from '../../../src/domain/environment/environment'
import {
  OUTRIGGER_POSITIONS,
  outriggerNodeName,
} from '../../../src/three/crane/OutriggerController'
import { PROVISIONAL_CRANE_SETUP } from '../../../src/three/crane/provisionalCraneSpec'
import { boxInFrameOf } from '../../../src/three/crane/rigLandmarks'
import { parseTruckCraneModel } from '../../../src/three/loaders/loadTruckCraneModel'
import { ExtraCrane } from '../../../src/three/scene/ExtraCrane'
import { upgradeCraneModel } from '../../../src/three/scene/upgradeCraneModel'
import { readCraneGlbWithoutTextures } from '../../helpers/craneGlb'

const GLB = await readCraneGlbWithoutTextures()
const quiet = { warn: () => {} }

/** Rampa FICTÍCIA de 3 % em X e 6 % em Z (≈ 3,8°: sobra inclinação depois dos 3° de nivelamento). */
const RAMP: TerrainSpec = { slopeXPercent: 3, slopeZPercent: 6, features: [] }

/** Quanto (m) o centro da base de cada sapata está acima (+) ou abaixo (−) do terreno. */
function padGaps(extra: ExtraCrane, terrain: TerrainSpec): number[] {
  const base = extra.rigInUse.base
  return OUTRIGGER_POSITIONS.map((position) => {
    const pad = base.getObjectByName(outriggerNodeName(position, 'pad'))!
    const box = boxInFrameOf(base, pad)!
    const centre = box.getCenter(new Vector3())
    const bottom = base.localToWorld(new Vector3(centre.x, box.min.y, centre.z))
    return bottom.y - terrainHeightAt(terrain, bottom.x, bottom.z)
  })
}

async function extraOnRamp(placement: CranePlacement): Promise<ExtraCrane> {
  const extra = new ExtraCrane({
    id: 'extra-1',
    label: 'Guindaste 2',
    setup: PROVISIONAL_CRANE_SETUP,
    scene: new Scene(),
    placement,
    invalidate: () => {},
    reducedMotion: true,
  })
  // Mesma ordem do `MultiCrane`: posiciona, depois troca o provisório pelo GLB.
  extra.setPlacement(RAMP, placement)
  const result = await upgradeCraneModel(extra, () => parseTruckCraneModel(GLB.slice(0)), {
    logger: quiet,
  })
  expect(result.status).toBe('model')
  return extra
}

describe('sapatas do guindaste adicional no terreno (F-25)', () => {
  beforeAll(() => {
    vi.stubGlobal('document', {
      createElement: () => ({ style: {}, dataset: {}, setAttribute: () => {}, remove: () => {} }),
    })
  })
  afterAll(() => {
    vi.unstubAllGlobals()
  })

  it('numa rampa, as quatro sapatas apoiam no terreno sob cada uma', async () => {
    const extra = await extraOnRamp({ x: 6, z: -3, headingDeg: 30 })

    for (const gap of padGaps(extra, RAMP)) expect(gap).toBeCloseTo(0, 3)
  })

  it('ao mudar de lugar, as sapatas acompanham o terreno novo', async () => {
    const extra = await extraOnRamp({ x: 6, z: -3, headingDeg: 30 })

    extra.setPlacement(RAMP, { x: -12, z: 20, headingDeg: 135 })

    for (const gap of padGaps(extra, RAMP)) expect(gap).toBeCloseTo(0, 3)
  })
})
