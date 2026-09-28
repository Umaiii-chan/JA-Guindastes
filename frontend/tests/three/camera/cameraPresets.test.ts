import { describe, expect, it } from 'vitest'

import { calculateOperationalGeometry } from '../../../src/domain/geometry/operationalGeometry'
import {
  CAMERA_FOV_DEG,
  CAMERA_LIMITS,
  CAMERA_PRESETS,
  type CameraFraming,
  type CameraView,
  fitDistance,
  framingPoints,
  isViewWithinLimits,
  maxPolarAngleAboveGround,
  OPERATOR_EYE_LOCAL,
  PERSPECTIVE_ELEVATION_DEG,
  perspectiveForAspect,
  resolveCameraPreset,
  rotateAroundY,
  type Vec3,
} from '../../../src/three/camera/cameraPresets'
import {
  PROVISIONAL_CRANE_GEOMETRY,
  PROVISIONAL_CRANE_INITIAL_STATE,
} from '../../../src/three/crane/provisionalCraneSpec'
import { expectClose } from '../../helpers/expectClose'

function framing(turretRotationDeg: number, maxReachM = 20.8): CameraFraming {
  const state = { ...PROVISIONAL_CRANE_INITIAL_STATE, turretRotationDeg }
  return {
    turretRotationDeg,
    geometry: calculateOperationalGeometry(state, PROVISIONAL_CRANE_GEOMETRY),
    maxReachM,
  }
}

/** Coordenadas normalizadas na tela (−1 a 1) do ponto visto da vista, como a câmera de `createCamera`. */
function project(view: CameraView, point: Vec3, aspect: number): { x: number; y: number } {
  const sub = (a: Vec3, b: Vec3) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z })
  const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z
  const cross = (a: Vec3, b: Vec3) => ({
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  })
  const unit = (a: Vec3) => {
    const length = Math.hypot(a.x, a.y, a.z)
    return { x: a.x / length, y: a.y / length, z: a.z / length }
  }
  const back = unit(sub(view.position, view.target))
  const right = unit(cross({ x: 0, y: 1, z: 0 }, back))
  const up = cross(back, right)
  const offset = sub(point, view.position)
  const depth = -dot(offset, back)
  const tanHalf = Math.tan((CAMERA_FOV_DEG * Math.PI) / 360)
  return {
    x: dot(offset, right) / (depth * tanHalf * aspect),
    y: dot(offset, up) / (depth * tanHalf),
  }
}

function direction(view: CameraView) {
  return {
    x: view.position.x - view.target.x,
    y: view.position.y - view.target.y,
    z: view.position.z - view.target.z,
  }
}

describe('cameraPresets', () => {
  it('tem as quatro predefinições da tarefa', () => {
    expect(CAMERA_PRESETS).toEqual(['perspectiva', 'lateral', 'topo', 'operador'])
  })

  it.each(CAMERA_PRESETS.flatMap((preset) => [0, 90, -135].map((psi) => [preset, psi] as const)))(
    '%s com ψ = %s°: câmera acima do chão e dentro dos limites de distância',
    (preset, psi) => {
      expect(isViewWithinLimits(resolveCameraPreset(preset, framing(psi)))).toBe(true)
    },
  )

  it('perspectiva: 3/4 baixa, com o alvo no centro do conjunto e o horizonte no terço de cima', () => {
    const f0 = framing(0)
    const view = resolveCameraPreset('perspectiva', f0)
    const d = direction(view)
    const distance = Math.hypot(d.x, d.y, d.z)

    // O alvo é o meio do conjunto (guindaste e anel), não a origem nem o chão.
    expect(view.target.y).toBeGreaterThan(1)
    expect(view.target.y).toBeLessThan(f0.geometry.tipHeightM)
    expectClose(d.y / distance, Math.sin((PERSPECTIVE_ELEVATION_DEG * Math.PI) / 180), 1e-9)
    // Horizonte acima do centro por tan(inclinação)/tan(FOV/2): no terço de cima da tela.
    const horizonNdc =
      Math.tan((PERSPECTIVE_ELEVATION_DEG * Math.PI) / 180) /
      Math.tan((CAMERA_FOV_DEG * Math.PI) / 360)
    expect(horizonNdc).toBeGreaterThan(1 / 3)
    expect(horizonNdc).toBeLessThan(1)
    // Mais perto que o enquadramento antigo da PoC (≈ 38 m do alvo).
    expect(distance).toBeLessThan(38)
  })

  it.each([
    ['16:9', 16 / 9],
    ['1:1', 1],
    ['coluna 0,58', 0.58],
  ])(
    'perspectiva em %s: o conjunto inteiro cabe no quadro e o preenche, sem cortar a lança',
    (_, aspect) => {
      const f = { ...framing(0), aspect }
      const view = resolveCameraPreset('perspectiva', f)
      const projected = framingPoints(f).map((point) => project(view, point, aspect))
      const maxX = Math.max(...projected.map((p) => Math.abs(p.x)))
      const maxY = Math.max(...projected.map((p) => Math.abs(p.y)))

      expect(maxX).toBeLessThanOrEqual(1)
      expect(maxY).toBeLessThanOrEqual(1)
      // Uma das dimensões encosta na folga escolhida: o conjunto não fica solto no meio do papel.
      const { fill } = perspectiveForAspect(aspect)
      expect(Math.max(maxX / fill.width, maxY / fill.height)).toBeGreaterThan(0.98)
      // Centrado na tela.
      const minX = Math.min(...projected.map((p) => p.x))
      const maxXSigned = Math.max(...projected.map((p) => p.x))
      expectClose((minX + maxXSigned) / 2, 0, 0.02)
    },
  )

  it('perspectiva em 1:1: o anel de raio ocupa cerca de 2/3 da largura', () => {
    const f = { ...framing(0), aspect: 1 }
    const view = resolveCameraPreset('perspectiva', f)
    const radius = f.geometry.workingRadiusM!
    const ring = Array.from({ length: 48 }, (_, index) => {
      const angle = (index / 48) * 2 * Math.PI
      return project(view, { x: radius * Math.sin(angle), y: 0, z: radius * Math.cos(angle) }, 1)
    })
    const width = (Math.max(...ring.map((p) => p.x)) - Math.min(...ring.map((p) => p.x))) / 2

    expect(width).toBeGreaterThan(0.6)
    expect(width).toBeLessThan(0.72)
  })

  it('perspectiva: quadro em coluna afasta a câmera e a põe mais alta; lança maior também afasta', () => {
    const wide = resolveCameraPreset('perspectiva', { ...framing(0), aspect: 16 / 9 })
    const tall = resolveCameraPreset('perspectiva', { ...framing(0), aspect: 0.6 })
    const length = (view: CameraView) => Math.hypot(...Object.values(direction(view)))
    expect(length(tall)).toBeGreaterThan(length(wide))
    expect(perspectiveForAspect(0.6).elevationDeg).toBeGreaterThan(
      perspectiveForAspect(16 / 9).elevationDeg,
    )
    expect(perspectiveForAspect(16 / 9).elevationDeg).toBe(PERSPECTIVE_ELEVATION_DEG)

    const state = { ...PROVISIONAL_CRANE_INITIAL_STATE, boomLengthM: 22 }
    const extended = resolveCameraPreset('perspectiva', {
      ...framing(0),
      geometry: calculateOperationalGeometry(state, PROVISIONAL_CRANE_GEOMETRY),
    })
    expect(length(extended)).toBeGreaterThan(length(wide))
  })

  it('aspecto inválido cai no 16:9', () => {
    expect(resolveCameraPreset('perspectiva', { ...framing(0), aspect: Number.NaN })).toEqual(
      resolveCameraPreset('perspectiva', { ...framing(0), aspect: 16 / 9 }),
    )
    expect(resolveCameraPreset('perspectiva', framing(0))).toEqual(
      resolveCameraPreset('perspectiva', { ...framing(0), aspect: 16 / 9 }),
    )
  })

  it('fitDistance: um ponto no plano do alvo, com FOV de 90° e quadro quadrado, pede distância 1', () => {
    const options = { fovDeg: 90, aspect: 1, fill: { width: 1, height: 1 } }
    const target = { x: 0, y: 0, z: 0 }
    expectClose(fitDistance([{ x: 1, y: 0, z: 0 }], target, { x: 0, y: 0, z: 1 }, options), 1, 1e-9)
    expectClose(fitDistance([{ x: 0, y: 2, z: 0 }], target, { x: 0, y: 0, z: 1 }, options), 2, 1e-9)
    // Metade do quadro: o dobro da distância.
    expectClose(
      fitDistance(
        [{ x: 1, y: 0, z: 0 }],
        target,
        { x: 0, y: 0, z: 1 },
        {
          ...options,
          fill: { width: 0.5, height: 1 },
        },
      ),
      2,
      1e-9,
    )
  })

  it.each([0, 90, 30])('lateral com ψ = %s°: olha perpendicular ao plano da lança', (psi) => {
    const view = resolveCameraPreset('lateral', framing(psi))
    const d = direction(view)
    const along = { x: Math.sin((psi * Math.PI) / 180), z: Math.cos((psi * Math.PI) / 180) }
    // Produto escalar horizontal com a direção da lança ≈ 0: a câmera está de lado.
    expectClose(d.x * along.x + d.z * along.z, 0, 1e-9)
    // O alvo fica entre o eixo de giro e o gancho, no plano da lança.
    const radius = framing(psi).geometry.workingRadiusM!
    expectClose(view.target.x, (along.x * radius) / 2, 1e-9)
    expectClose(view.target.z, (along.z * radius) / 2, 1e-9)
  })

  it('topo: olha de cima para o eixo de giro, alto o bastante para o alcance máximo', () => {
    const view = resolveCameraPreset('topo', framing(45))
    expect(view.target).toEqual({ x: 0, y: 0, z: 0 })
    expect(view.position.x).toBe(0)
    expect(view.position.y).toBeGreaterThan(2 * 20.8)
    // Quase vertical: desvio horizontal desprezível.
    expect(Math.abs(view.position.z) / view.position.y).toBeLessThan(0.01)
  })

  it.each([16 / 9, 0.58])(
    'topo e lateral com aspecto %s: o alcance máximo e a lança cabem no quadro',
    (aspect) => {
      const f = { ...framing(30), aspect }
      const top = resolveCameraPreset('topo', f)
      for (let index = 0; index < 24; index += 1) {
        const angle = (index / 24) * 2 * Math.PI
        const p = project(
          top,
          { x: 20.8 * Math.sin(angle), y: 0, z: 20.8 * Math.cos(angle) },
          aspect,
        )
        expect(Math.abs(p.x)).toBeLessThanOrEqual(1)
        expect(Math.abs(p.y)).toBeLessThanOrEqual(1)
      }
      const side = resolveCameraPreset('lateral', f)
      const tip = { x: f.geometry.hook.xM, y: f.geometry.tipHeightM, z: f.geometry.hook.zM }
      const p = project(side, tip, aspect)
      expect(Math.abs(p.x)).toBeLessThanOrEqual(1)
      expect(Math.abs(p.y)).toBeLessThanOrEqual(1)
    },
  )

  it('operador: do olho na torre, girando com ψ, olhando para o gancho G', () => {
    for (const psi of [0, 90, -60]) {
      const f = framing(psi)
      const view = resolveCameraPreset('operador', f)
      const eye = rotateAroundY(OPERATOR_EYE_LOCAL, psi)
      expectClose(view.position.x, eye.x, 1e-9)
      expectClose(view.position.z, eye.z, 1e-9)
      expectClose(view.position.y, OPERATOR_EYE_LOCAL.y, 1e-12)
      expectClose(view.target.x, f.geometry.hook.xM, 1e-9)
      expectClose(view.target.y, f.geometry.hook.yM, 1e-9)
      expectClose(view.target.z, f.geometry.hook.zM, 1e-9)
    }
  })

  it('operador: usa o olho medido no modelo quando há um', () => {
    const eye = { x: 0.9, y: 3, z: 0.2 }
    const view = resolveCameraPreset('operador', { ...framing(90), operatorEye: eye })
    const expected = rotateAroundY(eye, 90)

    expectClose(view.position.x, expected.x, 1e-9)
    expectClose(view.position.y, 3, 1e-12)
    expectClose(view.position.z, expected.z, 1e-9)
  })

  it('rotateAroundY gira como a torre: +Z vai para u(ψ) = (sin ψ, 0, cos ψ)', () => {
    const rotated = rotateAroundY({ x: 0, y: 2, z: 1 }, 90)
    expectClose(rotated.x, 1, 1e-12)
    expectClose(rotated.y, 2, 1e-12)
    expectClose(rotated.z, 0, 1e-12)
  })

  describe('maxPolarAngleAboveGround', () => {
    it('com o alvo no chão, a câmera fica logo acima do plano do alvo (< 90°)', () => {
      const angle = maxPolarAngleAboveGround(0, 30)
      expect(angle).toBeLessThan(Math.PI / 2)
      expectClose(0 + 30 * Math.cos(angle), CAMERA_LIMITS.minHeightM, 1e-9)
    })

    it('com o alvo alto, deixa olhar um pouco para cima sem descer abaixo da altura mínima', () => {
      const angle = maxPolarAngleAboveGround(7, 20)
      expect(angle).toBeGreaterThan(Math.PI / 2)
      expectClose(7 + 20 * Math.cos(angle), CAMERA_LIMITS.minHeightM, 1e-9)
    })

    it('nunca passa do limite absoluto, mesmo com o alvo muito alto', () => {
      expect(maxPolarAngleAboveGround(100, 5)).toBe(CAMERA_LIMITS.maxPolarAngleRad)
      expect(maxPolarAngleAboveGround(1, 0)).toBe(Math.PI / 2)
    })
  })
})
