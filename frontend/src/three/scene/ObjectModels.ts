import { Group, type Object3D, Mesh } from 'three'

import type { LibraryObject } from '../../domain/environment/objectLibrary'
import { loadGltf } from '../loaders/loadGltf'

// Modelos 3D da biblioteca de objetos (TASK-072; ADR-036): carrega cada GLB uma vez e entrega cópias
// que dividem a geometria e os materiais, então 20 árvores custam um arquivo. Nada aqui lê medida de
// cálculo do arquivo (RN-003): o tamanho e as caixas de colisão vêm da biblioteca.

export type ObjectModelLoader = (file: string) => Promise<Object3D>

/** Marca o que é compartilhado entre cópias: quem descarta a cena não pode liberar isso. */
export const SHARED_ASSET_KEY = 'sharedAsset'

function defaultLoader(file: string): Promise<Object3D> {
  return loadGltf(`${import.meta.env.BASE_URL}models/${file}`).then((loaded) => loaded.scene)
}

function enableShadows(root: Object3D): void {
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return
    object.castShadow = true
    object.receiveShadow = true
  })
}

export class ObjectModelCache {
  private readonly templates = new Map<string, Object3D>()
  private readonly pending = new Map<string, Promise<Object3D | null>>()
  private readonly failed = new Set<string>()
  private loader: ObjectModelLoader

  constructor(loader: ObjectModelLoader = defaultLoader) {
    this.loader = loader
  }

  /** Troca o carregador e esvazia o cache (testes). */
  reset(loader: ObjectModelLoader = defaultLoader): void {
    this.loader = loader
    this.templates.clear()
    this.pending.clear()
    this.failed.clear()
  }

  /** Modelo já carregado, ou `undefined` (ainda carregando ou com falha). */
  peek(id: string): Object3D | undefined {
    return this.templates.get(id)
  }

  /** `true` se o arquivo não pôde ser carregado; o objeto fica só como caixa. */
  hasFailed(id: string): boolean {
    return this.failed.has(id)
  }

  /** Carrega o modelo (uma vez só) e resolve com o molde, ou `null` se o arquivo não carregou. */
  load(object: LibraryObject): Promise<Object3D | null> {
    const ready = this.templates.get(object.id)
    if (ready) return Promise.resolve(ready)
    if (this.failed.has(object.id)) return Promise.resolve(null)
    const inFlight = this.pending.get(object.id)
    if (inFlight) return inFlight
    const promise = this.loader(object.file)
      .then((scene) => {
        const template = new Group()
        template.name = `objeto-${object.id}`
        template.userData[SHARED_ASSET_KEY] = true
        // Centra a planta quando o GLB não vem centrado (o guindaste estacionado).
        scene.position.set(object.modelOffset?.x ?? 0, 0, object.modelOffset?.z ?? 0)
        template.add(scene)
        enableShadows(template)
        this.templates.set(object.id, template)
        return template
      })
      .catch(() => {
        this.failed.add(object.id)
        return null
      })
      .finally(() => {
        this.pending.delete(object.id)
      })
    this.pending.set(object.id, promise)
    return promise
  }

  /** Cópia do modelo carregado (geometria e materiais compartilhados), ou `undefined`. */
  instance(id: string): Object3D | undefined {
    const template = this.templates.get(id)
    if (!template) return undefined
    const copy = template.clone(true)
    copy.userData[SHARED_ASSET_KEY] = true
    return copy
  }
}

/** Cache usado pela cena; o teste troca o carregador com `objectModels.reset(...)`. */
export const objectModels = new ObjectModelCache()
