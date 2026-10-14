import { describe, expect, it } from 'vitest'

import type { CollisionState } from '../../../src/domain/collision/collisions'
import { CraneController } from '../../../src/three/crane/CraneController'
import { createProvisionalCrane } from '../../../src/three/crane/createProvisionalCrane'
import {
  PROVISIONAL_CRANE_GEOMETRY,
  PROVISIONAL_CRANE_LIMITS,
} from '../../../src/three/crane/provisionalCraneSpec'
import { type CollisionGuard, SwitchableCrane } from '../../../src/three/crane/SwitchableCrane'
import type { CraneState } from '../../../src/three/crane/types'

function craneWith(forbidden: (state: CraneState) => boolean) {
  const results: CollisionState[] = []
  const guard: CollisionGuard = {
    evaluate: (state) => ({
      hits: forbidden(state) ? [{ subject: 'load', target: { kind: 'terrain' } }] : [],
      alerts: [],
      // Penetração: quanto o cabo passa de 2 m (só importa para o estado já colidindo).
      penetrationM: forbidden(state) ? Math.max(0.001, state.cableLengthM - 2) : 0,
    }),
    onResult: (result) => results.push(result),
  }
  const crane = new SwitchableCrane(
    new CraneController(
      createProvisionalCrane(),
      PROVISIONAL_CRANE_LIMITS,
      PROVISIONAL_CRANE_GEOMETRY,
      { boomAngleDeg: 30, boomLengthM: 12, cableLengthM: 3 },
    ),
  )
  crane.setCollisionGuard(guard)
  return { crane, results }
}

describe('guarda de colisões do SwitchableCrane', () => {
  it('corta o comando no estado seguro mais próximo do pedido, por busca binária', () => {
    const { crane, results } = craneWith((state) => state.cableLengthM > 7.25)

    const applied = crane.setCableLength(15)

    expect(applied).toBeGreaterThan(7.2499)
    expect(applied).toBeLessThanOrEqual(7.25)
    expect(crane.getState().cableLengthM).toBe(applied)
    expect(results.at(-1)).toMatchObject({ blocked: true })
    expect(results.at(-1)?.hits).toHaveLength(1)
  })

  it('comando seguro passa inteiro e limpa o bloqueio', () => {
    const { crane, results } = craneWith((state) => state.cableLengthM > 7.25)
    crane.setCableLength(15)

    expect(crane.setCableLength(5)).toBe(5)
    expect(results.at(-1)).toEqual({ hits: [], alerts: [], penetrationM: 0, blocked: false })
  })

  it('vale para qualquer comando, não só o cabo', () => {
    const { crane } = craneWith((state) => state.boomAngleDeg > 50)

    expect(crane.setBoomAngle(80)).toBeLessThanOrEqual(50)
    expect(crane.setBoomAngle(80)).toBeGreaterThan(49.999)
  })

  it('já colidindo (o cenário mudou), só passa o que não aumenta a penetração', () => {
    const { crane, results } = craneWith((state) => state.cableLengthM > 2)

    // Descer mais é recusado: o cabo fica onde estava (3 m).
    expect(crane.setCableLength(10)).toBeCloseTo(3, 3)
    expect(results.at(-1)?.blocked).toBe(true)
    // Subir o cabo sai da colisão.
    expect(crane.setCableLength(1)).toBe(1)
    expect(results.at(-1)).toMatchObject({ blocked: false, hits: [] })
  })

  it('sem guarda, comanda como antes; `revalidate` avisa o estado atual', () => {
    const { crane, results } = craneWith(() => false)
    crane.setCollisionGuard(null)
    expect(crane.setCableLength(15)).toBe(15)

    const guarded = craneWith((state) => state.cableLengthM > 2)
    guarded.crane.revalidate()
    expect(guarded.results.at(-1)?.hits).toHaveLength(1)
    expect(results).toHaveLength(1)
  })
})
