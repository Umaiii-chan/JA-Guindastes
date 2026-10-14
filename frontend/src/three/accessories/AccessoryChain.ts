import { Box3, Group, type Object3D, Vector3 } from 'three'

import { loadGltf } from '../loaders/loadGltf'

// Cadeia de acessórios de içamento entre o gancho e a carga (TASK-056; ADR-026; RN-014).
//
// Só desenho: o peso de cada acessório entra no cálculo do BACKEND (RN-008). Aqui cada acessório
// ocupa, de cima para baixo, `riggingHeightM` metros; a soma dessa altura desce a carga (ver
// `computeLoadBox`, parâmetro `accessoriesDropM`).
//
// Modelos 3D: só de terceiros, em GLB/glTF (ADR-026). NADA é modelado por código como substituto:
// sem arquivo (`modelUrl: null`) ou com o arquivo ausente/inválido, o acessório entra só no peso e na
// distância, sem malha, e o aviso "modelo 3D pendente" fica por conta da UI.

export const ACCESSORY_CHAIN_NAMES = {
  root: 'hook-load-accessories',
  item: (index: number) => `hook-load-accessory-${index}`,
} as const

/** Um acessório como a cena o desenha. */
export interface SceneAccessory {
  readonly id: string
  /** Altura que o acessório ocupa na cadeia, em metros (≥ 0). */
  readonly riggingHeightM: number
  /** URL do GLB/glTF, ou `null` com o modelo 3D pendente. */
  readonly modelUrl: string | null
}

/** Carrega o modelo de uma URL e devolve a cena dele. Padrão: `loadGltf`. */
export type AccessoryModelLoader = (url: string, signal: AbortSignal) => Promise<Object3D>

export const loadAccessoryGltf: AccessoryModelLoader = async (url, signal) =>
  (await loadGltf(url, { signal })).scene

export interface AccessoryChainOptions {
  /** `null` desliga o carregamento (só peso e distância). Padrão: `loadAccessoryGltf`. */
  readonly loader?: AccessoryModelLoader | null
  /** Avisado quando o modelo de um acessório chega (`true`) ou falha (`false`). */
  readonly onModelResult?: (accessoryId: string, loaded: boolean) => void
  /** Avisado quando a malha muda por causa de um carregamento assíncrono (a cena precisa redesenhar). */
  readonly onChange?: () => void
}

function sanitizedHeight(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0
}

function sameChain(a: readonly SceneAccessory[], b: readonly SceneAccessory[]): boolean {
  return (
    a.length === b.length &&
    a.every(
      (item, index) =>
        item.id === b[index].id &&
        sanitizedHeight(item.riggingHeightM) === sanitizedHeight(b[index].riggingHeightM) &&
        item.modelUrl === b[index].modelUrl,
    )
  )
}

export class AccessoryChain {
  /** Origem no ponto onde o primeiro acessório se prende; o +Y local aponta para cima (−Y é para baixo). */
  readonly root = new Group()

  private readonly loader: AccessoryModelLoader | null
  private readonly onModelResult?: (accessoryId: string, loaded: boolean) => void
  private readonly onChange?: () => void
  private readonly abort = new AbortController()
  private readonly templates = new Map<string, Promise<Object3D>>()
  private accessories: readonly SceneAccessory[] = []
  private generation = 0
  private drop = 0
  private disposed = false

  constructor(options: AccessoryChainOptions = {}) {
    this.loader = options.loader === undefined ? loadAccessoryGltf : options.loader
    this.onModelResult = options.onModelResult
    this.onChange = options.onChange
    this.root.name = ACCESSORY_CHAIN_NAMES.root
  }

  /** Soma de `riggingHeightM` da cadeia atual (m): quanto a carga desce abaixo do gancho. */
  get totalDropM(): number {
    return this.drop
  }

  /** Acessórios da cadeia atual, na ordem do gancho para a carga. */
  get current(): readonly SceneAccessory[] {
    return this.accessories
  }

  /** Troca a cadeia. Devolve `true` se algo mudou (a mesma lista não refaz nada). */
  setAccessories(list: readonly SceneAccessory[]): boolean {
    if (this.disposed || sameChain(list, this.accessories)) return false
    this.accessories = list.map((item) => ({ ...item }))
    this.generation += 1
    this.clearSlots()
    let cursor = 0
    this.accessories.forEach((item, index) => {
      const height = sanitizedHeight(item.riggingHeightM)
      const slot = new Group()
      slot.name = ACCESSORY_CHAIN_NAMES.item(index)
      slot.userData = { accessoryId: item.id, riggingHeightM: height }
      slot.position.y = -cursor
      this.root.add(slot)
      cursor += height
      if (item.modelUrl !== null && this.loader !== null) {
        void this.fillSlot(slot, item, height, this.generation)
      }
    })
    this.drop = cursor
    return true
  }

  /** Para os carregamentos em curso e solta as referências. A geometria é liberada com a cena. */
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.abort.abort()
    this.clearSlots()
    this.templates.clear()
    this.root.removeFromParent()
  }

  private clearSlots(): void {
    for (const slot of [...this.root.children]) slot.removeFromParent()
  }

  private template(url: string, loader: AccessoryModelLoader): Promise<Object3D> {
    let pending = this.templates.get(url)
    if (!pending) {
      pending = loader(url, this.abort.signal)
      this.templates.set(url, pending)
      // Falhou: deixa tentar de novo numa próxima troca da cadeia.
      pending.catch(() => this.templates.delete(url))
    }
    return pending
  }

  private async fillSlot(
    slot: Group,
    item: SceneAccessory,
    height: number,
    generation: number,
  ): Promise<void> {
    const url = item.modelUrl
    const loader = this.loader
    if (url === null || loader === null) return
    try {
      const template = await this.template(url, loader)
      if (this.disposed || generation !== this.generation) return
      slot.add(fitModel(template.clone(true), height))
      this.onChange?.()
      this.onModelResult?.(item.id, true)
    } catch (error) {
      if (this.disposed || generation !== this.generation) return
      console.warn(`Modelo 3D do acessório "${item.id}" indisponível (${url}):`, error)
      this.onModelResult?.(item.id, false)
    }
  }
}

/**
 * Encaixa o modelo no espaço do acessório: com `heightM > 0`, escala uniforme para a altura do modelo
 * ser `heightM`; sem altura, mantém a escala do arquivo. O topo do modelo fica na origem do espaço e o
 * centro horizontal, no eixo do cabo.
 */
function fitModel(model: Object3D, heightM: number): Object3D {
  const holder = new Group()
  holder.add(model)
  holder.updateMatrixWorld(true)
  const size = new Box3().setFromObject(model).getSize(new Vector3())
  if (heightM > 0 && size.y > 0) model.scale.multiplyScalar(heightM / size.y)
  holder.updateMatrixWorld(true)
  const box = new Box3().setFromObject(model)
  if (!box.isEmpty()) {
    const center = box.getCenter(new Vector3())
    model.position.set(-center.x, -box.max.y, -center.z)
  }
  return holder
}
