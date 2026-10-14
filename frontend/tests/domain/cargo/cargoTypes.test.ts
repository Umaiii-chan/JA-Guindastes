// Tipos de carga (leva F): catálogo, modelos GLB em public/models/cargas e escala para as medidas.

import { statSync } from 'node:fs'
import { resolve } from 'node:path'

import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { getBounds } from '@gltf-transform/functions'
import { describe, expect, it } from 'vitest'

import {
  CARGO_TYPES,
  cargoModelScale,
  DEFAULT_CARGO_TYPE,
  findCargoModelType,
  findCargoType,
  normalizeCargoType,
} from '../../../src/domain/cargo/cargoTypes'

const MODELS_DIR = resolve(__dirname, '../../../public/models')
const CARGO_MB_LIMIT = 3

describe('catálogo de tipos de carga', () => {
  it('começa pela caixa simples e traz os tipos pedidos, com rótulos em português', () => {
    expect(DEFAULT_CARGO_TYPE).toBe('caixa')
    expect(CARGO_TYPES[0]).toEqual({ id: 'caixa', label: 'Caixa simples' })
    const labels = CARGO_TYPES.map((type) => type.label)
    for (const wanted of [
      'Caixa simples',
      'Contêiner',
      'Viga de concreto',
      'Feixe de tubos',
      'Gerador',
      'Transformador',
      'Caixa de madeira',
    ]) {
      expect(labels).toContain(wanted)
    }
    const ids = CARGO_TYPES.map((type) => type.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('só a caixa simples fica sem modelo', () => {
    for (const type of CARGO_TYPES) {
      expect(type.file === undefined, type.id).toBe(type.id === 'caixa')
      expect(type.baseSize === undefined, type.id).toBe(type.id === 'caixa')
    }
    expect(findCargoModelType('caixa')).toBeUndefined()
    expect(findCargoModelType('nao-existe')).toBeUndefined()
    expect(findCargoModelType(undefined)).toBeUndefined()
    expect(findCargoModelType('conteiner')?.file).toBe('cargas/conteiner.glb')
    expect(findCargoType('nao-existe')).toBeUndefined()
  })

  it('normaliza o tipo: o padrão e o desconhecido viram ausência', () => {
    expect(normalizeCargoType('conteiner')).toBe('conteiner')
    expect(normalizeCargoType('caixa')).toBeUndefined()
    expect(normalizeCargoType('lixo')).toBeUndefined()
    expect(normalizeCargoType(undefined)).toBeUndefined()
    expect(normalizeCargoType(null)).toBeUndefined()
  })

  it('escala o modelo para as medidas: largura em X, altura em Y, comprimento em Z', () => {
    const container = findCargoType('conteiner')!
    const scale = cargoModelScale(container, { lengthM: 12.02, widthM: 2.4, heightM: 5.8 })!
    expect(scale.x).toBeCloseTo(1)
    expect(scale.y).toBeCloseTo(2)
    expect(scale.z).toBeCloseTo(2)
    expect(
      cargoModelScale(findCargoType('caixa')!, { lengthM: 1, widthM: 1, heightM: 1 }),
    ).toBeNull()
  })
})

describe('arquivos GLB das cargas', () => {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  const withModel = CARGO_TYPES.filter((type) => type.file !== undefined)

  it.each(withModel.map((type) => [type.id, type] as const))(
    '%s existe, tem o tamanho do catálogo, a base em y = 0 e até 3 MB',
    async (_id, type) => {
      const file = resolve(MODELS_DIR, type.file!)
      expect(statSync(file).size / 1024 / 1024).toBeLessThanOrEqual(CARGO_MB_LIMIT)
      const doc = await io.read(file)
      const bounds = getBounds(doc.getRoot().listScenes()[0]!)
      const base = type.baseSize!
      expect(bounds.max[0] - bounds.min[0]).toBeCloseTo(base.w, 1)
      expect(bounds.max[1] - bounds.min[1]).toBeCloseTo(base.h, 1)
      expect(bounds.max[2] - bounds.min[2]).toBeCloseTo(base.d, 1)
      // Centro da planta na origem e base em y = 0 (a cena escala e assenta o modelo a partir daí).
      expect(Math.abs(bounds.min[1])).toBeLessThan(0.02)
      expect(Math.abs((bounds.min[0] + bounds.max[0]) / 2)).toBeLessThan(0.02)
      expect(Math.abs((bounds.min[2] + bounds.max[2]) / 2)).toBeLessThan(0.02)
    },
  )

  it('o galpão também fica em até 3 MB', () => {
    const file = resolve(MODELS_DIR, 'objetos/barracao-aberto.glb')
    expect(statSync(file).size / 1024 / 1024).toBeLessThanOrEqual(CARGO_MB_LIMIT)
  })
})
