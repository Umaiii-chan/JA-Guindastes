import { BoxGeometry, Color, Group, LineSegments, Mesh, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import {
  HALO_INTENSITY,
  HALO_INTENSITY_UNKNOWN,
  HOOK_LOAD_NAMES,
  HookLoad,
} from '../../../src/three/scene/HookLoad'
import { STATUS_COLORS } from '../../../src/three/scene/palette'

function setup() {
  const hook = new Group()
  const hookLoad = new HookLoad(hook)
  return { hook, hookLoad }
}

describe('HookLoad', () => {
  it('sem carga, fica só o halo em volta do gancho', () => {
    const { hook, hookLoad } = setup()

    expect(hookLoad.root.parent).toBe(hook)
    expect(hook.getObjectByName(HOOK_LOAD_NAMES.halo)).toBeInstanceOf(Mesh)
    expect(hook.getObjectByName(HOOK_LOAD_NAMES.box)).toBeUndefined()
    expect(hookLoad.currentLayout).toBeNull()
  })

  it('com carga, desenha a caixa com as medidas pedidas, abaixo do gancho, presa pelas lingas', () => {
    const { hook, hookLoad } = setup()

    hookLoad.setLoad({ lengthM: 4, widthM: 2, heightM: 1.5 })

    const box = hook.getObjectByName(HOOK_LOAD_NAMES.box) as Mesh<BoxGeometry>
    expect(box.geometry.parameters).toMatchObject({ width: 2, height: 1.5, depth: 4 })
    expect(box.castShadow).toBe(true)
    expect(box.position.y + 1.5 / 2).toBeLessThan(0)
    const slings = hook.getObjectByName(HOOK_LOAD_NAMES.slings) as LineSegments
    expect(slings.geometry.getAttribute('position').count).toBe(8)
    // O halo envolve a caixa.
    const halo = hook.getObjectByName(HOOK_LOAD_NAMES.halo)!
    expect(halo.position.y).toBeCloseTo(box.position.y)
    expect(halo.scale.z).toBeGreaterThan(2)
  })

  it('trocar a carga refaz a caixa e libera a geometria antiga; `null` volta a só o gancho', () => {
    const { hook, hookLoad } = setup()
    hookLoad.setLoad({ lengthM: 4, widthM: 2, heightM: 1.5 })
    const first = (hook.getObjectByName(HOOK_LOAD_NAMES.box) as Mesh).geometry
    let disposed = false
    first.addEventListener('dispose', () => {
      disposed = true
    })

    hookLoad.setLoad({ lengthM: 6, widthM: 2, heightM: 1.5 })
    expect(disposed).toBe(true)
    expect(hook.getObjectsByProperty('name', HOOK_LOAD_NAMES.box)).toHaveLength(1)

    hookLoad.setLoad(null)
    expect(hook.getObjectByName(HOOK_LOAD_NAMES.box)).toBeUndefined()
    const halo = hook.getObjectByName(HOOK_LOAD_NAMES.halo)!
    expect(halo.scale.equals(new Vector3(0.95, 0.95, 0.95))).toBe(true)
  })

  it('as mesmas medidas num objeto novo não refazem a caixa', () => {
    const { hook, hookLoad } = setup()
    hookLoad.setLoad({ lengthM: 4, widthM: 2, heightM: 1.5 })
    const box = hook.getObjectByName(HOOK_LOAD_NAMES.box)

    hookLoad.setLoad({ lengthM: 4, widthM: 2, heightM: 1.5 })

    expect(hook.getObjectByName(HOOK_LOAD_NAMES.box)).toBe(box)
  })

  it('pinta o halo com a cor da situação (cinza por padrão)', () => {
    const { hookLoad } = setup()

    expect(hookLoad.haloColor.equals(new Color(STATUS_COLORS.unknown))).toBe(true)
    hookLoad.setStatus('warning')
    expect(hookLoad.haloColor.equals(new Color(STATUS_COLORS.warning))).toBe(true)
  })

  it('o halo é sutil, e mais discreto ainda sem situação', () => {
    const { hookLoad } = setup()

    expect(hookLoad.haloIntensity).toBe(HALO_INTENSITY_UNKNOWN)
    hookLoad.setStatus('over')
    expect(hookLoad.haloIntensity).toBe(HALO_INTENSITY)
    expect(HALO_INTENSITY).toBeLessThanOrEqual(0.5)
    hookLoad.setStatus('unknown')
    expect(hookLoad.haloIntensity).toBe(HALO_INTENSITY_UNKNOWN)
  })

  it('dispose tira o grupo do gancho', () => {
    const { hook, hookLoad } = setup()
    hookLoad.setLoad({ lengthM: 1, widthM: 1, heightM: 1 })

    hookLoad.dispose()

    expect(hook.children).toHaveLength(0)
  })
})
