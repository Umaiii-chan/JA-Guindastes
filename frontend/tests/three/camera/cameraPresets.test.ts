import { describe, expect, it } from 'vitest'

import { calculateOperationalGeometry } from '../../../src/domain/geometry/operationalGeometry'
import {
  CAMERA_LIMITS,
  CAMERA_PRESETS,
  type CameraFraming,
  type CameraView,
  isViewWithinLimits,
  maxPolarAngleAboveGround,
  OPERATOR_EYE_LOCAL,
  resolveCameraPreset,
  rotateAroundY,
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

  it('perspectiva: é a vista inicial da PoC para uma lança de até 20 m, e se afasta para lanças maiores', () => {
    const small = resolveCameraPreset('perspectiva', framing(0, 18))
    expect(small.position).toEqual({ x: 22, y: 13, z: 28 })
    expect(small.target).toEqual({ x: 0, y: 7, z: 3 })

    const large = resolveCameraPreset('perspectiva', framing(0, 40))
    expect(large.position).toEqual({ x: 44, y: 26, z: 56 })
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
