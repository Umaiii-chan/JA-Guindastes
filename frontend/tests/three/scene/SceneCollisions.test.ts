import { describe, expect, it } from 'vitest'

import type { CollisionState } from '../../../src/domain/collision/collisions'
import { EMPTY_SCENARIO, type Obstacle } from '../../../src/domain/environment/environment'
import { buildCraneScene } from '../../../src/three/scene/buildCraneScene'
import {
  COLLISION_HIGHLIGHT_NAME,
  CollisionHighlight,
} from '../../../src/three/scene/CollisionHighlight'
import { STATUS_COLORS } from '../../../src/three/scene/palette'

const LOAD = { lengthM: 4, widthM: 2, heightM: 1.5 }

const WALL: Obstacle = {
  id: 'muro-1',
  label: 'Muro FICTÍCIO',
  kind: 'box',
  centerX: 0,
  centerZ: 8.4,
  widthM: 8,
  depthM: 1,
  heightM: 9,
  rotationYDeg: 0,
}

function sceneWithGuard() {
  const contents = buildCraneScene()
  // R = 9,2 m: a carga de 4 m começa depois da cabine do chassi (a pose inicial a rasparia).
  contents.crane.setBoomLength(14)
  contents.crane.setBoomAngle(40)
  const states: CollisionState[] = []
  contents.collisions.setListener((state) => states.push(state))
  contents.crane.setCollisionGuard(contents.collisions)
  return { contents, states }
}

/** Altura do fundo da carga no mundo, pelo estado do guindaste e a caixa do gancho. */
function loadBottomY(contents: ReturnType<typeof buildCraneScene>): number {
  const layout = contents.hookLoad.currentLayout!
  return contents.crane.getOperationalGeometry().hookHeightM + layout.center.y - layout.size.y / 2
}

describe('SceneCollisions', () => {
  it('mede o corpo do guindaste provisório: base, torre, lança e extensão', () => {
    const { collisions } = buildCraneScene()
    const frames = collisions.currentBody.boxes.map((box) => box.frame)

    expect(frames).toEqual(['base', 'turret', 'boom', 'boomExtension'])
    expect(collisions.currentBody.boxes.map((box) => box.id)).toContain('crane-turret')
  })

  it('o cabo para quando a carga toca o chão (RN-012)', () => {
    const { contents, states } = sceneWithGuard()
    contents.hookLoad.setLoad(LOAD)

    const applied = contents.crane.setCableLength(15)

    expect(applied).toBeLessThan(15)
    expect(loadBottomY(contents)).toBeGreaterThanOrEqual(-1e-3)
    expect(loadBottomY(contents)).toBeLessThan(0.01)
    const last = states.at(-1)!
    expect(last.blocked).toBe(true)
    expect(last.hits.some((hit) => hit.target.kind === 'terrain')).toBe(true)
    // A carga fica destacada em vermelho enquanto o comando está bloqueado.
    expect(contents.hookLoad.collisionHighlighted).toBe(true)
  })

  it('sem carga, o gancho não atravessa o chão', () => {
    const { contents, states } = sceneWithGuard()

    const applied = contents.crane.setCableLength(15)

    const geometry = contents.crane.getOperationalGeometry()
    expect(applied).toBeLessThan(15)
    expect(geometry.hookHeightM).toBeGreaterThan(-0.01)
    expect(states.at(-1)?.hits[0]).toMatchObject({ subject: 'hook', target: { kind: 'terrain' } })
  })

  it('soltar a carga do chão (cabo curto de novo) limpa o bloqueio e o destaque', () => {
    const { contents, states } = sceneWithGuard()
    contents.hookLoad.setLoad(LOAD)
    contents.crane.setCableLength(15)

    contents.crane.setCableLength(3)

    expect(states.at(-1)).toEqual({ hits: [], alerts: [], penetrationM: 0, blocked: false })
    expect(contents.hookLoad.collisionHighlighted).toBe(false)
  })

  it('obstáculo no caminho do giro: o giro para antes dele e o contorno vermelho aparece', () => {
    const { contents, states } = sceneWithGuard()
    contents.hookLoad.setLoad(LOAD)
    contents.crane.setCableLength(2)
    const geometry = contents.crane.getOperationalGeometry()
    // Com ψ = 0 a carga está em (0, R); com ψ = 90° estaria em (R, 0), onde fica o bloco.
    contents.collisions.setScenario({
      ...EMPTY_SCENARIO,
      obstacles: [
        { ...WALL, centerX: geometry.hook.zM, centerZ: 0, widthM: 2, depthM: 2, heightM: 12 },
      ],
    })

    const applied = contents.crane.setTurretRotation(90)

    expect(applied).toBeGreaterThan(0)
    expect(applied).toBeLessThan(90)
    const last = states.at(-1)!
    expect(last.blocked).toBe(true)
    expect(last.hits.some((hit) => hit.target.kind === 'obstacle')).toBe(true)
    expect(contents.collisions.highlight.outlineCount).toBeGreaterThanOrEqual(1)
  })

  it('lança atravessando um obstáculo só alerta, sem bloquear', () => {
    const { contents, states } = sceneWithGuard()
    contents.collisions.setScenario({
      ...EMPTY_SCENARIO,
      obstacles: [
        {
          ...WALL,
          id: 'poste',
          label: 'Poste FICTÍCIO',
          kind: 'cylinder',
          centerX: 0,
          centerZ: 5,
          widthM: 0.3,
          heightM: 30,
        },
      ],
    })
    contents.crane.revalidate()

    const last = states.at(-1)!
    expect(last.hits).toEqual([])
    expect(last.blocked).toBe(false)
    expect(last.alerts.map((alert) => alert.segment)).toContain('boom')
  })
  it('o terreno do cenário vale: com um morro sob a carga, o cabo para mais alto', () => {
    const { contents } = sceneWithGuard()
    contents.hookLoad.setLoad(LOAD)
    const flat = contents.crane.setCableLength(15)
    const geometry = contents.crane.getOperationalGeometry()
    contents.crane.setCableLength(3)
    contents.collisions.setScenario({
      ...EMPTY_SCENARIO,
      terrain: {
        slopeXPercent: 0,
        slopeZPercent: 0,
        features: [
          {
            id: 'morro',
            kind: 'plateau',
            centerX: geometry.hook.xM,
            centerZ: geometry.hook.zM,
            radiusM: 8,
            heightM: 2,
          },
        ],
      },
    })

    const onHill = contents.crane.setCableLength(15)

    expect(flat - onHill).toBeCloseTo(2, 1)
  })

  it('troca de modelo: o corpo é medido de novo no rig novo', () => {
    const { collisions } = buildCraneScene()
    const before = collisions.currentBody
    collisions.setRig(buildCraneScene().rig)

    expect(collisions.currentBody).not.toBe(before)
    expect(collisions.currentBody.boxes).toHaveLength(before.boxes.length)
  })
})

describe('TASK-063: nenhum comando aumenta a penetração', () => {
  it('na pose inicial (que já raspa a cabine), giro, lança e cabo nunca pioram a colisão', () => {
    const contents = buildCraneScene()
    contents.hookLoad.setLoad(LOAD)
    contents.crane.setCollisionGuard(contents.collisions)
    const penetration = () => contents.collisions.evaluate(contents.crane.getState()).penetrationM
    const start = penetration()

    for (const turret of [-90, -45, 0, 45, 90]) {
      contents.crane.setTurretRotation(turret)
      for (const boom of [5, 40, 75]) contents.crane.setBoomAngle(boom)
      contents.crane.setCableLength(40)
      contents.crane.setBoomLength(10)
      contents.crane.setCableLength(0.5)
      // Cada comando termina sem colisão ou, no máximo, tão fundo quanto o estado de partida.
      expect(penetration()).toBeLessThanOrEqual(Math.max(start, 0) + 1e-6)
    }
  })

  it('sem carga, o gancho não desce para dentro do chassi nem do terreno', () => {
    const { crane, collisions } = buildCraneScene()
    crane.setCollisionGuard(collisions)
    crane.setBoomAngle(5)
    crane.setCableLength(40)
    const report = collisions.evaluate(crane.getState())
    expect(report.hits).toEqual([])
    expect(crane.getOperationalGeometry().hookHeightM).toBeGreaterThanOrEqual(-1e-3)
  })
})

describe('CollisionHighlight', () => {
  it('contorna obstáculo e peça do guindaste atingidos; o terreno não tem contorno', () => {
    const highlight = new CollisionHighlight()
    const obb = {
      center: { x: 1, y: 2, z: 3 },
      axes: [
        { x: 1, y: 0, z: 0 },
        { x: 0, y: 1, z: 0 },
        { x: 0, y: 0, z: 1 },
      ] as const,
      half: { x: 1, y: 1, z: 1 },
    }

    highlight.show({
      blocked: true,
      alerts: [],
      penetrationM: 1,
      hits: [
        { subject: 'load', target: { kind: 'terrain' } },
        { subject: 'load', target: { kind: 'obstacle', id: 'a', label: 'A', obb } },
        { subject: 'load', target: { kind: 'crane', part: 'crane-boom', obb } },
      ],
    })

    expect(highlight.root.name).toBe(COLLISION_HIGHLIGHT_NAME)
    expect(highlight.outlineCount).toBe(2)
    expect(highlight.root.children[0].position.toArray()).toEqual([1, 2, 3])

    highlight.show({ blocked: false, alerts: [], penetrationM: 0, hits: [] })
    expect(highlight.outlineCount).toBe(0)
    highlight.dispose()
  })

  it('a carga atingida fica vermelha e volta ao normal', () => {
    const { hookLoad } = buildCraneScene()
    hookLoad.setLoad(LOAD)
    const box = hookLoad.root.getObjectByName('hook-load-box') as import('three').Mesh<
      import('three').BoxGeometry,
      import('three').MeshStandardMaterial
    >
    const normal = box.material.color.getHex()

    hookLoad.setCollisionHighlight(true)
    expect(box.material.color.getHex()).not.toBe(normal)
    expect(box.material.color.getHex()).toBe(
      box.material.color.clone().setHex(STATUS_COLORS.over).getHex(),
    )

    hookLoad.setCollisionHighlight(false)
    expect(box.material.color.getHex()).toBe(normal)
  })
})
