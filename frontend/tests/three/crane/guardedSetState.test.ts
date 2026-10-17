// Comando em lote guardado (`SwitchableCrane.setState`, TASK-077) com varredura do caminho
// (TASK-092): um salto grande num quadro não atravessa um obstáculo fino (F-08 da auditoria), e o
// giro perto de ±180° vai pelo menor ângulo, sem pular para o outro lado do obstáculo (F-11).
// Postes e guindaste FICTÍCIOS (ADR-012).

import { describe, expect, it } from 'vitest'

import type { CollisionState } from '../../../src/domain/collision/collisions'
import { EMPTY_SCENARIO } from '../../../src/domain/environment/environment'
import { CraneController } from '../../../src/three/crane/CraneController'
import { createProvisionalCrane } from '../../../src/three/crane/createProvisionalCrane'
import {
  PROVISIONAL_CRANE_GEOMETRY,
  PROVISIONAL_CRANE_LIMITS,
} from '../../../src/three/crane/provisionalCraneSpec'
import { type CollisionGuard, SwitchableCrane } from '../../../src/three/crane/SwitchableCrane'
import type { CraneLimits, CraneState } from '../../../src/three/crane/types'
import { buildCraneScene } from '../../../src/three/scene/buildCraneScene'

/** Giro em [0°, 360°), para comparar ângulos dos dois lados de ±180°. */
function to360(deg: number): number {
  return ((deg % 360) + 360) % 360
}

/** Cena provisória com um poste FICTÍCIO de 30 m de altura no raio de trabalho, em ψ = `atDeg`. */
function sceneWithPole(atDeg: number, sizeM: number) {
  const contents = buildCraneScene()
  contents.crane.setCollisionGuard(contents.collisions)
  const radiusM = contents.crane.getOperationalGeometry().workingRadiusM!
  const at = (atDeg * Math.PI) / 180
  contents.collisions.setScenario({
    ...EMPTY_SCENARIO,
    obstacles: [
      {
        id: 'poste-ficticio',
        label: 'Poste FICTÍCIO',
        kind: 'box',
        centerX: radiusM * Math.sin(at),
        centerZ: radiusM * Math.cos(at),
        widthM: sizeM,
        depthM: sizeM,
        heightM: 30,
        rotationYDeg: 0,
      },
    ],
  })
  return { contents, radiusM }
}

/** Guindaste provisório com uma guarda falsa que proíbe os estados de `forbidden`. */
function craneWith(forbidden: (state: CraneState) => boolean, limits = PROVISIONAL_CRANE_LIMITS) {
  const results: CollisionState[] = []
  let evaluations = 0
  const guard: CollisionGuard = {
    evaluate: (state) => {
      evaluations += 1
      return {
        hits: forbidden(state) ? [{ subject: 'load', target: { kind: 'terrain' } }] : [],
        alerts: [],
        penetrationM: forbidden(state) ? 0.5 : 0,
      }
    },
    onResult: (result) => results.push(result),
  }
  const crane = new SwitchableCrane(
    new CraneController(createProvisionalCrane(), limits, PROVISIONAL_CRANE_GEOMETRY, {
      boomAngleDeg: 30,
      boomLengthM: 12,
      cableLengthM: 3,
    }),
  )
  crane.setCollisionGuard(guard)
  return { crane, results, evaluations: () => evaluations }
}

describe('setState guardado: varredura do caminho (F-08)', () => {
  it('poste de 0,2 m em ψ = 12°: o salto 4° → 20° para antes do poste, como o comando de um eixo', () => {
    const lote = sceneWithPole(12, 0.2)
    expect(lote.radiusM).toBeCloseTo(10.29, 2)
    lote.contents.crane.setState({ turretRotationDeg: 4 })
    // O destino (20°) está livre: antes, o lote só conferia o estado final e atravessava o poste.
    expect(
      lote.contents.collisions.evaluate({
        ...lote.contents.crane.getState(),
        turretRotationDeg: 20,
      }).hits,
    ).toHaveLength(0)

    const applied = lote.contents.crane.setState({ turretRotationDeg: 20 })

    const umEixo = sceneWithPole(12, 0.2)
    umEixo.contents.crane.setTurretRotation(4)
    const manual = umEixo.contents.crane.setTurretRotation(20)
    expect(manual).toBeGreaterThan(9)
    expect(manual).toBeLessThan(12)
    expect(applied.turretRotationDeg).toBeLessThan(12)
    expect(applied.turretRotationDeg).toBeCloseTo(manual, 2)
    expect(lote.contents.collisions.state.blocked).toBe(true)
  })

  it('obstáculo só entre 5° e 7°: o salto 0° → 15° num quadro para em 5°', () => {
    const { crane, results } = craneWith(
      (state) => state.turretRotationDeg > 5 && state.turretRotationDeg < 7,
    )

    const applied = crane.setState({ turretRotationDeg: 15 })

    expect(applied.turretRotationDeg).toBeLessThanOrEqual(5)
    expect(applied.turretRotationDeg).toBeGreaterThan(4.99)
    expect(results.at(-1)).toMatchObject({ blocked: true })
    // O mesmo salto pelo comando de um eixo também para em 5°.
    crane.setState({ turretRotationDeg: 0 })
    expect(crane.setTurretRotation(15)).toBeCloseTo(applied.turretRotationDeg, 6)
  })

  it('recua todos os campos juntos ao último estado seguro do caminho', () => {
    // Faixa proibida de giro no meio do caminho; os outros campos mudam junto e param na mesma fração.
    const { crane } = craneWith(
      (state) => state.turretRotationDeg > 20 && state.turretRotationDeg < 22,
    )

    const applied = crane.setState({ turretRotationDeg: 40, cableLengthM: 7 })

    const fraction = applied.turretRotationDeg / 40
    expect(applied.turretRotationDeg).toBeCloseTo(20, 4)
    expect(applied.cableLengthM).toBeCloseTo(3 + 4 * fraction, 6)
  })

  it('caminho livre: aplica o pedido inteiro, sem bloqueio', () => {
    const { crane, results } = craneWith(() => false)

    expect(crane.setState({ turretRotationDeg: 90, boomAngleDeg: 60 })).toMatchObject({
      turretRotationDeg: 90,
      boomAngleDeg: 60,
    })
    expect(results.at(-1)).toMatchObject({ blocked: false, hits: [] })
  })

  it('limita o custo: no máximo ~400 passos de varredura num salto grande', () => {
    const { crane, evaluations } = craneWith(() => false)
    const before = evaluations()

    crane.setState({ turretRotationDeg: 179, boomAngleDeg: 80, boomLengthM: 22, cableLengthM: 15 })

    // Estado anterior + até 399 amostras + estado pedido.
    expect(evaluations() - before).toBeLessThanOrEqual(401)
  })

  it('sem guarda (`guarded: false`, reprodução de gravação), aplica como veio', () => {
    const { crane, results } = craneWith(
      (state) => state.turretRotationDeg > 5 && state.turretRotationDeg < 7,
    )

    const applied = crane.setState({ turretRotationDeg: 15 }, { guarded: false })

    expect(applied.turretRotationDeg).toBe(15)
    expect(results.at(-1)).toMatchObject({ blocked: false })
  })
})

describe('setState guardado perto de ±180° (F-11)', () => {
  it('poste em 184°: de 179,5° para −178° (= 182°) para antes do poste, pelo menor ângulo', () => {
    const lote = sceneWithPole(184, 0.5)
    lote.contents.crane.setState({ turretRotationDeg: 179.5 })
    expect(lote.contents.collisions.state.hits).toHaveLength(0)

    const applied = lote.contents.crane.setState({ turretRotationDeg: -178 })

    // Antes: a busca ia pela reta 179,5° → −178° (o caminho longo) e aplicava −173,1° (= 186,9°),
    // do outro lado do poste. Agora fica entre a partida e o poste.
    const psi = to360(applied.turretRotationDeg)
    expect(psi).toBeGreaterThanOrEqual(179.5)
    expect(psi).toBeLessThan(184)
    expect(lote.contents.collisions.state.blocked).toBe(true)
    // E bate com o comando de um eixo, que também vai pelo menor ângulo (giro contínuo).
    const umEixo = sceneWithPole(184, 0.5)
    umEixo.contents.crane.setTurretRotation(179.5)
    const manual = umEixo.contents.crane.setTurretRotation(-178)
    expect(to360(manual)).toBeCloseTo(psi, 2)
  })

  it('caminho livre por ±180°: chega ao pedido sem varrer a volta longa', () => {
    // Obstáculo na frente (ψ perto de 0°): o caminho longo de 170° a −170° passaria por ele.
    const { crane, results } = craneWith((state) => Math.abs(state.turretRotationDeg) < 30)
    crane.setState({ turretRotationDeg: 170 })

    expect(crane.setState({ turretRotationDeg: -170 }).turretRotationDeg).toBe(-170)
    expect(results.at(-1)).toMatchObject({ blocked: false })
  })

  it('guindaste com limites de giro (não contínuo): o caminho fica dentro da faixa', () => {
    // FICTÍCIO: faixa −170°..170°; o batente em ±170° impede passar por 180°.
    const limited: CraneLimits = {
      ...PROVISIONAL_CRANE_LIMITS,
      turretRotationDeg: { min: -170, max: 170 },
    }
    const { crane } = craneWith((state) => Math.abs(state.turretRotationDeg) < 30, limited)
    crane.setState({ turretRotationDeg: 160 })

    const applied = crane.setState({ turretRotationDeg: -160 })

    // Vai pela frente (o único caminho) e para no obstáculo, em 30°.
    expect(applied.turretRotationDeg).toBeCloseTo(30, 4)
  })
})
