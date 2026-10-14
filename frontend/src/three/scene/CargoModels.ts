import type { Object3D } from 'three'

import { cargoModelScale, findCargoModelType } from '../../domain/cargo/cargoTypes'
import type { LoadDimensions } from './loadBox'
import { ObjectModelCache } from './ObjectModels'

// Modelos 3D dos tipos de carga (leva F): carrega cada GLB uma vez e entrega cópias que dividem a
// geometria e os materiais, escaladas para as medidas da carga (largura em X, altura em Y, comprimento
// em Z; origem no centro da base). Só desenho: o peso e a colisão continuam pela caixa da carga.

/** Cache dos modelos de carga; o teste troca o carregador com `cargoModels.reset(...)`. */
export const cargoModels = new ObjectModelCache()

/** Id do modelo da carga, ou `undefined` na caixa simples (ou tipo desconhecido). */
export function cargoModelId(load: LoadDimensions | null | undefined): string | undefined {
  return findCargoModelType(load?.cargoType)?.id
}

/**
 * Carrega o modelo do tipo da carga. Resolve `true` quando o modelo está pronto para `cargoModelInstance`
 * e `false` na caixa simples ou se o arquivo não carregou (a cena fica com a caixa).
 */
export async function loadCargoModel(load: LoadDimensions | null | undefined): Promise<boolean> {
  const type = findCargoModelType(load?.cargoType)
  if (!type?.file) return false
  const template = await cargoModels.load({ id: type.id, file: type.file })
  return template !== null
}

/**
 * Cópia do modelo do tipo da carga, na escala das medidas, ou `undefined` se não há modelo (caixa
 * simples) ou ele ainda não chegou.
 */
export function cargoModelInstance(load: LoadDimensions): Object3D | undefined {
  const type = findCargoModelType(load.cargoType)
  if (!type) return undefined
  const scale = cargoModelScale(type, load)
  const copy = cargoModels.instance(type.id)
  if (!scale || !copy) return undefined
  copy.scale.set(scale.x, scale.y, scale.z)
  return copy
}
