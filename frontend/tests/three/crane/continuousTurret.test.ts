// Giro contínuo (TASK-092; F-22 da auditoria): sem ψ_min/ψ_max na ficha (ADR-013 C-4), o comando
// do giro dá a volta em ±180° e vai pelo menor ângulo, também na guarda de colisões. Com limites de
// giro, continua o clamp. Limites e obstáculos FICTÍCIOS (ADR-012).

import { describe, expect, it } from 'vitest'

import { CONTINUOUS_TURRET_RANGE } from '../../../src/app/craneSetup'
import { fitTurretRotation } from '../../../src/application/planning/trajectoryPlayback'
import { interpolateCraneState } from '../../../src/application/recording/playback'
import type { RecordingFrame } from '../../../src/application/recording/recording'
import type { CollisionState } from '../../../src/domain/collision/collisions'
import { CraneController } from '../../../src/three/crane/CraneController'
import { createProvisionalCrane } from '../../../src/three/crane/createProvisionalCrane'
import {
  PROVISIONAL_CRANE_GEOMETRY,
  PROVISIONAL_CRANE_LIMITS,
} from '../../../src/three/crane/provisionalCraneSpec'
import { type CollisionGuard, SwitchableCrane } from '../../../src/three/crane/SwitchableCrane'
import { fitTurretToRange, turretTravelDeg } from '../../../src/three/crane/turretRotation'
import type { CraneLimits, CraneState } from '../../../src/three/crane/types'

/** FICTÍCIO: guindaste com batente de giro em ±170° (não contínuo). */
const LIMITED: CraneLimits = {
  ...PROVISIONAL_CRANE_LIMITS,
  turretRotationDeg: { min: -170, max: 170 },
}

function to360(deg: number): number {
  return ((deg % 360) + 360) % 360
}

function controller(limits: CraneLimits = PROVISIONAL_CRANE_LIMITS, turretRotationDeg = 0) {
  return new CraneController(createProvisionalCrane(), limits, PROVISIONAL_CRANE_GEOMETRY, {
    turretRotationDeg,
    boomAngleDeg: 30,
    boomLengthM: 12,
    cableLengthM: 3,
  })
}

function guardedCrane(
  forbidden: (state: CraneState) => boolean,
  limits: CraneLimits = PROVISIONAL_CRANE_LIMITS,
) {
  const results: CollisionState[] = []
  const guard: CollisionGuard = {
    evaluate: (state) => ({
      hits: forbidden(state) ? [{ subject: 'load', target: { kind: 'terrain' } }] : [],
      alerts: [],
      penetrationM: forbidden(state) ? 0.5 : 0,
    }),
    onResult: (result) => results.push(result),
  }
  const crane = new SwitchableCrane(controller(limits))
  crane.setCollisionGuard(guard)
  return { crane, results }
}

describe('faixa do giro', () => {
  it('sem ficha e sem limites de giro na ficha, a faixa é marcada como giro contínuo', () => {
    expect(PROVISIONAL_CRANE_LIMITS.turretRotationDeg).toMatchObject({ continuous: true })
    expect(CONTINUOUS_TURRET_RANGE).toMatchObject({ min: -180, max: 180, continuous: true })
  })

  it('giro contínuo dá a volta; dentro da faixa, fica como veio', () => {
    const range = CONTINUOUS_TURRET_RANGE
    expect(fitTurretToRange(181, range)).toBe(-179)
    expect(fitTurretToRange(-181, range)).toBe(179)
    // Fora da faixa, a volta cai em [mín, mín + 360°): 540° é o mesmo giro que ±180°.
    expect(fitTurretToRange(540, range)).toBe(-180)
    expect(fitTurretToRange(-180, range)).toBe(-180)
    expect(fitTurretToRange(180, range)).toBe(180)
    expect(fitTurretToRange(45, range)).toBe(45)
  })

  it('com limites de giro, continua o clamp', () => {
    expect(fitTurretToRange(200, LIMITED.turretRotationDeg)).toBe(170)
    expect(fitTurretToRange(-200, LIMITED.turretRotationDeg)).toBe(-170)
  })

  it('o giro contínuo anda pelo menor ângulo; com limites, pela diferença direta', () => {
    expect(turretTravelDeg(170, -170, CONTINUOUS_TURRET_RANGE)).toBe(20)
    expect(turretTravelDeg(-170, 170, CONTINUOUS_TURRET_RANGE)).toBe(-20)
    expect(turretTravelDeg(179.5, -178, CONTINUOUS_TURRET_RANGE)).toBeCloseTo(2.5, 9)
    // Meia volta exata: vale o sentido pedido (Home no slider leva 0° a −180° pela direita).
    expect(turretTravelDeg(0, -180, CONTINUOUS_TURRET_RANGE)).toBe(-180)
    expect(turretTravelDeg(0, 180, CONTINUOUS_TURRET_RANGE)).toBe(180)
    // −180° e 180° são o mesmo giro: não há volta.
    expect(turretTravelDeg(-180, 180, CONTINUOUS_TURRET_RANGE)).toBe(0)
    expect(turretTravelDeg(160, -160, LIMITED.turretRotationDeg)).toBe(-320)
  })
})

describe('CraneController com giro contínuo', () => {
  it('passar de 180° continua girando do outro lado (a seta na ponta do slider)', () => {
    const crane = controller(PROVISIONAL_CRANE_LIMITS, 180)

    expect(crane.setTurretRotation(181)).toBe(-179)
    expect(crane.setTurretRotation(-181)).toBe(179)
    expect(crane.setState({ turretRotationDeg: 190 }).turretRotationDeg).toBe(-170)
    expect(controller(PROVISIONAL_CRANE_LIMITS, -400).getState().turretRotationDeg).toBe(-40)
  })

  it('com limites de giro, o controller continua limitando à faixa', () => {
    const crane = controller(LIMITED)

    expect(crane.setTurretRotation(200)).toBe(170)
    expect(crane.setTurretRotation(-200)).toBe(-170)
  })
})

describe('guarda de colisões com giro contínuo', () => {
  it('de 170° para −170°: gira 20° por trás, sem conferir a volta longa pela frente', () => {
    // Obstáculo na frente: o caminho longo (340° pela frente) pararia nele.
    const { crane, results } = guardedCrane((state) => Math.abs(state.turretRotationDeg) < 30)
    crane.setTurretRotation(170)

    expect(crane.setTurretRotation(-170)).toBe(-170)
    expect(results.at(-1)).toMatchObject({ blocked: false })
  })

  it('obstáculo atrás, entre 175° e −175°: o mesmo comando para nele, antes de passar por 180°', () => {
    const { crane, results } = guardedCrane((state) => {
      const psi = to360(state.turretRotationDeg)
      return psi > 175 && psi < 185
    })
    crane.setTurretRotation(170)

    const applied = crane.setTurretRotation(-170)

    expect(applied).toBeCloseTo(175, 4)
    expect(applied).toBeLessThanOrEqual(175)
    expect(results.at(-1)).toMatchObject({ blocked: true })
  })

  it('a seta além de 180° passa pela guarda no caminho curto', () => {
    const { crane } = guardedCrane((state) => {
      const psi = to360(state.turretRotationDeg)
      return psi > 180.4 && psi < 182
    })
    crane.setTurretRotation(180)

    // Pedido 181° (a seta na ponta): vai para −179°, mas para no obstáculo em 180,4° (= −179,6°).
    expect(crane.setTurretRotation(181)).toBeCloseTo(-179.6, 4)
  })

  it('com limites de giro, o caminho é o de dentro da faixa e o clamp continua', () => {
    const { crane } = guardedCrane((state) => Math.abs(state.turretRotationDeg) < 30, LIMITED)
    crane.setTurretRotation(160)

    // Pela frente (o batente em ±170° impede passar por 180°): para no obstáculo, em 30°.
    expect(crane.setTurretRotation(-160)).toBeCloseTo(30, 4)
    const free = guardedCrane(() => false, LIMITED)
    expect(free.crane.setTurretRotation(200)).toBe(170)
  })
})

describe('reprodução de gravação continua igual (TASK-077 CA-2 e CA-3)', () => {
  function frame(tMs: number, turretRotationDeg: number): RecordingFrame {
    return {
      tMs,
      crane: { turretRotationDeg, boomAngleDeg: 40, boomLengthM: 12, cableLengthM: 5 },
      configurationId: 'cfg-ficticia',
      loadWeightKg: 1000,
      evaluation: null,
    }
  }

  it('a pose interpolada por ±180° é aplicada sem guarda exatamente como vem', () => {
    // A guarda proibiria tudo: na reprodução ela só reavalia, nada é recuado.
    const { crane, results } = guardedCrane(() => true)
    const frames = [frame(0, 170), frame(1000, -160)]

    for (const positionMs of [0, 250, 500, 750, 1000]) {
      const pose = interpolateCraneState(frames, positionMs)!
      const turret = fitTurretRotation(pose.turretRotationDeg, crane.limits.turretRotationDeg)
      const applied = crane.setState({ ...pose, turretRotationDeg: turret }, { guarded: false })
      expect(applied.turretRotationDeg).toBe(turret)
      expect(results.at(-1)?.blocked).toBe(false)
    }
  })
})
