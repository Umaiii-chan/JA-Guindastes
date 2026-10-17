// @vitest-environment jsdom
/// <reference types="node" />
import { BufferGeometry, Group, LineSegments } from 'three'
import { describe, expect, it, vi } from 'vitest'

import { EMPTY_SCENARIO } from '../../../src/domain/environment/environment'
import { TANDEM_SLING_DROP_M } from '../../../src/domain/tandem/tandem'
import { parseTruckCraneModel } from '../../../src/three/loaders/loadTruckCraneModel'
import { buildCraneScene } from '../../../src/three/scene/buildCraneScene'
import {
  type ExtraCraneInput,
  PRIMARY_CRANE_ID,
  type TandemSceneConfig,
  type TandemSceneFrame,
} from '../../../src/three/scene/MultiCrane'
import { PROVISIONAL_CRANE_SETUP } from '../../../src/three/crane/provisionalCraneSpec'
import { TANDEM_CARGO_NAMES } from '../../../src/three/scene/TandemCargo'
import { hookDropM, withLiveHookDrops } from '../../../src/three/scene/tandemRigging'
import {
  type CraneModelLoader,
  upgradeCraneModel,
} from '../../../src/three/scene/upgradeCraneModel'
import { readCraneGlbWithoutTextures } from '../../helpers/craneGlb'

// TASK-090 (F-16): no tandem, as lingas saem do fim do moitão de cada guindaste. Os dois guindastes
// usam o GLB 80 t (o moitão desce ~1,965 m abaixo de G, medido pela auditoria de 2026-10-16), lado a
// lado, com a carga FICTÍCIA (ADR-012) à frente, como em `MultiCrane.test.ts`.

const GLB = await readCraneGlbWithoutTextures()
const fromDisk: CraneModelLoader = () => parseTruckCraneModel(GLB.slice(0))
const quiet = { warn: () => undefined }

const SECOND: ExtraCraneInput = {
  id: 'extra-1',
  label: 'Guindaste 2',
  setup: PROVISIONAL_CRANE_SETUP,
  placement: { x: 8, z: 0, headingDeg: 0 },
}

const TANDEM: TandemSceneConfig = {
  followerId: 'extra-1',
  load: { lengthM: 8, widthM: 2, heightM: 1.5 },
  cargo: { x: 4, z: 10.5, rotationYDeg: 90 },
}

async function twoGlbCranes() {
  const contents = buildCraneScene()
  await upgradeCraneModel(contents, fromDisk, { logger: quiet })
  const frames: (TandemSceneFrame | null)[] = []
  contents.multi.configure({
    invalidate: () => undefined,
    loadModel: fromDisk,
    signal: new AbortController().signal,
    reducedMotion: true,
    onCollision: () => undefined,
    onExtrasChange: () => undefined,
    onTandemFrame: (frame) => frames.push(frame),
  })
  contents.crane.setCollisionGuard(contents.multi.guardFor(PRIMARY_CRANE_ID, contents.collisions))
  contents.multi.setScenario(EMPTY_SCENARIO)
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  contents.multi.setExtras([SECOND])
  await vi.waitFor(() => expect(contents.multi.getExtra('extra-1')?.usingModel).toBe(true), {
    timeout: 20_000,
  })
  const leaderHook = () => contents.hookLoad
  const followerHook = () => contents.multi.getExtra('extra-1')?.hookLoad
  const engageWith = (config: TandemSceneConfig) => {
    contents.multi.setTandemCargo(withLiveHookDrops(config, leaderHook, followerHook))
    return contents.multi.engage()
  }
  return { contents, frames, leaderHook, followerHook, engageWith }
}

describe('tandem com o moitão do GLB 80 t', () => {
  it('reproduz a auditoria: com o moitão medido, ele não entra mais na carga', async () => {
    const { frames, leaderHook, followerHook, engageWith } = await twoGlbCranes()
    const attach = [leaderHook().currentAttachOffsetM, followerHook()?.currentAttachOffsetM ?? 0]
    // A medida do moitão do GLB que a auditoria usou: 1,965 m abaixo de G.
    expect(attach[0]).toBeCloseTo(1.965, 2)
    expect(attach[1]).toBeCloseTo(1.965, 2)

    const result = engageWith(TANDEM)

    expect(result?.reachable).toBe(true)
    const frame = frames.at(-1)!
    const top = frame.cargo.bottomY + TANDEM.load.heightM
    expect(frame.cargo.bottomY).toBeCloseTo(0, 2)
    frame.hooks.forEach((hook, index) => {
      const hookBottom = hook.y - (attach[index] ?? 0)
      // Antes: G a 1,5 m do topo, e o moitão entrava ~0,465 m na carga. Agora sobram as lingas.
      expect(hookBottom - top).toBeCloseTo(TANDEM_SLING_DROP_M, 2)
    })
  }, 60_000)

  it('as lingas saem do fim do moitão, não de G', async () => {
    const { contents, frames, leaderHook, engageWith } = await twoGlbCranes()
    engageWith(TANDEM)
    const frame = frames.at(-1)!

    const slings = contents.scene.getObjectByName(TANDEM_CARGO_NAMES.slings) as LineSegments
    const positions = (slings.geometry as BufferGeometry).getAttribute('position')

    // Primeiro par de vértices: do gancho do guindaste 1 até a face de cima da carga.
    expect(positions.getY(0)).toBeCloseTo(frame.hooks[0].y - leaderHook().currentAttachOffsetM, 4)
    expect(positions.getY(1)).toBeCloseTo(frame.cargo.bottomY + TANDEM.load.heightM, 4)
  }, 60_000)

  it('a cadeia de acessórios do guindaste 1 sobe o gancho dele, lida na hora', async () => {
    const { contents, frames, engageWith } = await twoGlbCranes()
    // Gancho giratório + manilha FICTÍCIOS (0,75 m), postos depois de configurar o tandem.
    contents.hookLoad.setAccessories(new Group(), 0.75)

    engageWith(TANDEM)

    const frame = frames.at(-1)!
    expect(frame.hooks[0].y - frame.hooks[1].y).toBeCloseTo(0.75, 2)
    expect(frame.cargo.bottomY).toBeCloseTo(0, 2)
  }, 60_000)
})

describe('hookDropM', () => {
  it('soma o engate do gancho e a cadeia de acessórios; sem gancho, NaN', () => {
    expect(hookDropM({ currentAttachOffsetM: 1.965, currentAccessoriesDropM: 0.75 })).toBeCloseTo(
      2.715,
    )
    expect(hookDropM(undefined)).toBeNaN()
  })
})
