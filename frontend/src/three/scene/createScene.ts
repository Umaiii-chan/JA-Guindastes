import { Scene } from 'three'

/** Cria a cena 3D vazia; ambiente e guindaste são adicionados por `buildCraneScene`. */
export function createScene(): Scene {
  return new Scene()
}
