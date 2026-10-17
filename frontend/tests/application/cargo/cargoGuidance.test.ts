import { describe, expect, it } from 'vitest'

import { cargoGuidance } from '../../../src/application/cargo/cargoGuidance'
import { type CargoStatus, INACTIVE_CARGO } from '../../../src/domain/cargo/cargoOperation'

const GROUND: CargoStatus = {
  ...INACTIVE_CARGO,
  active: true,
  hasDelivery: true,
  state: { phase: 'ground', x: 10, z: 0, rotationYDeg: 0, result: 'none' },
  gapM: 6,
  slingDropM: 2.4,
  offsetM: 4,
}

describe('dicas da coleta e entrega', () => {
  it('sem carga posicionada, é o modo livre e o primeiro passo está em andamento', () => {
    const guidance = cargoGuidance({
      status: INACTIVE_CARGO,
      cargoPlaced: false,
      deliveryPlaced: false,
    })
    expect(guidance.currentStep).toBe('position')
    expect(guidance.message).toContain('Modo livre')
  })

  it('pede o ponto de entrega quando só a carga foi posicionada', () => {
    const guidance = cargoGuidance({
      status: INACTIVE_CARGO,
      cargoPlaced: true,
      deliveryPlaced: false,
    })
    expect(guidance.message).toContain('Ponto de entrega')
  })

  it('com tudo posicionado, diz o que falta para engatar', () => {
    const guidance = cargoGuidance({ status: GROUND, cargoPlaced: true, deliveryPlaced: true })
    expect(guidance.currentStep).toBe('engage')
    expect(guidance.steps[0]?.done).toBe(true)
    expect(guidance.message).toContain('alinhe o gancho')
    expect(guidance.message).toContain('baixe o gancho até 2,40 m do topo')
    expect(guidance.message).toContain('as lingas esticam')
  })

  it('com o gancho abaixo do ponto em que as lingas esticam, manda subir até ele (F-19)', () => {
    const guidance = cargoGuidance({
      status: { ...GROUND, gapM: 1.2, offsetM: 0.1 },
      cargoPlaced: true,
      deliveryPlaced: true,
    })
    expect(guidance.message).toContain('suba o gancho até 2,40 m do topo')
  })

  it('manda tocar em Engatar quando o gancho está no lugar', () => {
    const guidance = cargoGuidance({
      status: { ...GROUND, canEngage: true, gapM: 2.6, offsetM: 0.1 },
      cargoPlaced: true,
      deliveryPlaced: true,
    })
    expect(guidance.message).toContain('Engatar')
  })

  it('com a carga engatada, orienta a levar e soltar', () => {
    const guidance = cargoGuidance({
      status: {
        ...GROUND,
        state: {
          phase: 'hooked',
          x: 10,
          z: 0,
          rotationYDeg: 0,
          result: 'none',
          hooked: { offsetX: 0, offsetZ: 0, yawDeg: 0, slingDropM: 0.4 },
        },
        gapM: null,
        offsetM: null,
        heightAboveGroundM: 1.5,
        distanceToDeliveryM: 6,
      },
      cargoPlaced: true,
      deliveryPlaced: true,
    })
    expect(guidance.currentStep).toBe('deliver')
    expect(guidance.message).toContain('ponto de entrega')
  })

  it('os textos de soltura servem para o chão e para a carroceria (TASK-103)', () => {
    const hooked: CargoStatus = {
      ...GROUND,
      state: {
        phase: 'hooked',
        x: 10,
        z: 0,
        rotationYDeg: 0,
        result: 'none',
        hooked: { offsetX: 0, offsetZ: 0, yawDeg: 0, slingDropM: 0.4 },
      },
      gapM: null,
      offsetM: null,
      heightAboveGroundM: 1.5,
      distanceToDeliveryM: 6,
    }
    const input = { cargoPlaced: true, deliveryPlaced: true }
    const far = cargoGuidance({ ...input, status: hooked }).message
    expect(far).toContain('do apoio, no chão ou sobre o veículo ou contêiner')
    expect(far).not.toMatch(/do chão \(/)
    const ready = cargoGuidance({
      ...input,
      status: { ...hooked, canRelease: true, heightAboveGroundM: 0.1 },
    }).message
    expect(ready).toContain('rente ao apoio (chão, carroceria, convés ou teto do contêiner)')
    expect(ready).toContain('Toque em Soltar')
    expect(ready).not.toContain('perto do chão')
    const noDelivery = cargoGuidance({
      ...input,
      status: { ...hooked, canRelease: true, distanceToDeliveryM: null },
    }).message
    expect(noDelivery).toBe(
      'A carga está rente ao apoio (chão, carroceria, convés ou teto do contêiner). Toque em Soltar.',
    )
  })

  it('mostra o sucesso com o tempo, e o aviso quando caiu fora', () => {
    const delivered = cargoGuidance({
      status: {
        ...GROUND,
        state: {
          phase: 'ground',
          x: 0,
          z: 10,
          rotationYDeg: 0,
          result: 'delivered',
          elapsedMs: 83_400,
        },
      },
      cargoPlaced: true,
      deliveryPlaced: true,
    })
    expect(delivered.tone).toBe('ok')
    expect(delivered.currentStep).toBeNull()
    expect(delivered.message).toContain('Entregue')
    expect(delivered.message).toContain('1:23,4')

    const outside = cargoGuidance({
      status: { ...GROUND, state: { ...GROUND.state!, result: 'outside' } },
      cargoPlaced: true,
      deliveryPlaced: true,
    })
    expect(outside.tone).toBe('warning')
    expect(outside.message).toContain('Fora do ponto de entrega')
  })
})
