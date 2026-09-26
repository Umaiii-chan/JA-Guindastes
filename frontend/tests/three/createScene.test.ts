import { Scene } from 'three'
import { describe, expect, it } from 'vitest'

import { createScene } from '../../src/three/scene/createScene'

describe('createScene', () => {
  it('cria uma cena Three.js vazia', () => {
    const scene = createScene()

    expect(scene).toBeInstanceOf(Scene)
    expect(scene.children).toHaveLength(0)
  })
})
