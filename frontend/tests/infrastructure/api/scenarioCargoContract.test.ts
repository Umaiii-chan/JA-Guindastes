// Contrato da carga e do ponto de entrega no cenário salvo (TASK-073). Dados FICTÍCIOS.

import { describe, expect, it } from 'vitest'

import {
  clampDeliveryRadius,
  placeCargoAt,
  placeDeliveryAt,
  removeCargo,
  removeDelivery,
} from '../../../src/application/environment/cargoEditing'
import { obstacleConflictIds } from '../../../src/application/environment/obstacleConflicts'
import { environmentSummary } from '../../../src/application/environment/scenarioEditing'
import { timelineMarkers } from '../../../src/application/recording/playback'
import type { RecordingFrame } from '../../../src/application/recording/recording'
import { GROUND_CARGO_ID, NO_COLLISION } from '../../../src/domain/collision/collisions'
import { computeLoadBox } from '../../../src/domain/collision/loadBox'
import { EMPTY_SCENARIO, type ScenarioSpec } from '../../../src/domain/environment/environment'
import {
  mapScenarioSpec,
  toScenarioSpecDto,
} from '../../../src/infrastructure/api/scenarioRestClient'

const SPEC: ScenarioSpec = {
  ...EMPTY_SCENARIO,
  cargo: { x: -6, z: 4, rotationYDeg: 30 },
  delivery: { x: 8, z: -3, rotationYDeg: 0, radiusM: 2.5 },
}

describe('cenário com carga e ponto de entrega', () => {
  it('ida e volta pelo JSON do backend em snake_case', () => {
    const dto = toScenarioSpecDto(SPEC)
    expect(dto.cargo).toEqual({ x: -6, z: 4, rotation_y_deg: 30 })
    expect(dto.delivery).toEqual({ x: 8, z: -3, rotation_y_deg: 0, radius_m: 2.5 })
    expect(mapScenarioSpec(dto, 'spec')).toEqual(SPEC)
  })

  it('cenário antigo continua abrindo e salvando igual', () => {
    const dto = toScenarioSpecDto(EMPTY_SCENARIO)
    expect(dto).not.toHaveProperty('cargo')
    expect(dto).not.toHaveProperty('delivery')
    expect(mapScenarioSpec({ ...dto, cargo: null, delivery: null }, 'spec')).toEqual(EMPTY_SCENARIO)
  })

  it('aparece no resumo do cenário', () => {
    expect(environmentSummary(SPEC)).toContain('carga posicionada')
    expect(environmentSummary(SPEC)).toContain('ponto de entrega')
  })
})

describe('edição da carga e da entrega', () => {
  it('posiciona, mantém giro e raio ao reposicionar e remove', () => {
    const placed = placeDeliveryAt(placeCargoAt(EMPTY_SCENARIO, 1.234, 5.678), 3, 4)
    expect(placed.cargo).toEqual({ x: 1.23, z: 5.68, rotationYDeg: 0 })
    expect(placed.delivery).toEqual({ x: 3, z: 4, rotationYDeg: 0, radiusM: 2 })

    const moved = placeDeliveryAt(
      { ...placed, delivery: { ...placed.delivery!, radiusM: 4 } },
      7,
      7,
    )
    expect(moved.delivery?.radiusM).toBe(4)

    expect(removeCargo(placed)).not.toHaveProperty('cargo')
    expect(removeDelivery(placed)).not.toHaveProperty('delivery')
  })

  it('limita o raio do alvo', () => {
    expect(clampDeliveryRadius(0.1)).toBe(0.5)
    expect(clampDeliveryRadius(99)).toBe(30)
    expect(clampDeliveryRadius(Number.NaN)).toBe(2)
  })

  it('a carga no chão não vai à avaliação como obstáculo em conflito', () => {
    const collision = {
      ...NO_COLLISION,
      hits: [
        {
          subject: 'hook' as const,
          target: {
            kind: 'obstacle' as const,
            id: GROUND_CARGO_ID,
            label: 'Carga',
            obb: { center: { x: 0, y: 0, z: 0 }, axes: [], half: { x: 1, y: 1, z: 1 } } as never,
          },
        },
      ],
    }
    expect(obstacleConflictIds(EMPTY_SCENARIO, null, collision)).toEqual([])
  })
})

describe('carga engatada fora do eixo', () => {
  it('desloca e gira a caixa e as lingas, com a altura das lingas medida no engate', () => {
    const layout = computeLoadBox({ lengthM: 4, widthM: 2, heightM: 1 }, 1, 0, {
      offsetX: 0.3,
      offsetZ: -0.2,
      yawDeg: 90,
      slingDropM: 0.4,
    })
    expect(layout?.center).toEqual({ x: 0.3, y: -1.4 - 0.5, z: -0.2 })
    expect(layout?.slingTop.y).toBeCloseTo(-1, 6)
    expect(layout?.yawDeg).toBe(90)
    // Com 90°, o canto (-largura/2, -comprimento/2) = (-1, -2) vai para (-2, 1) somado ao desvio.
    expect(layout?.slingBottoms[0]?.x).toBeCloseTo(0.3 - 2, 6)
    expect(layout?.slingBottoms[0]?.z).toBeCloseTo(-0.2 + 1, 6)
  })
})

describe('marcadores da gravação', () => {
  const frame = (tMs: number, cargo: RecordingFrame['cargo']): RecordingFrame => ({
    tMs,
    crane: { turretRotationDeg: 0, boomAngleDeg: 45, boomLengthM: 12, cableLengthM: 5 },
    configurationId: 'c',
    loadWeightKg: 0,
    evaluation: null,
    cargo,
  })

  it('marca engatar e soltar (com a entrega) pelas mudanças de fase', () => {
    const ground = {
      phase: 'ground' as const,
      x: 0,
      z: 0,
      rotationYDeg: 0,
      result: 'none' as const,
    }
    const hooked = {
      ...ground,
      phase: 'hooked' as const,
      hooked: { offsetX: 0, offsetZ: 0, yawDeg: 0, slingDropM: 0.4 },
    }
    const markers = timelineMarkers([
      frame(0, ground),
      frame(1000, hooked),
      frame(5000, { ...ground, result: 'delivered' }),
    ])
    expect(markers).toEqual([
      { tMs: 1000, kind: 'engage', label: 'Carga engatada' },
      { tMs: 5000, kind: 'release', label: 'Carga entregue' },
    ])
  })

  it('gravações antigas, sem carga, não ganham marcadores', () => {
    expect(timelineMarkers([frame(0, undefined), frame(500, undefined)])).toEqual([])
  })
})
