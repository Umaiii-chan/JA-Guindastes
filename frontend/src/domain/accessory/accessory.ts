// Acessórios de içamento (TASK-056; ADR-026; RN-014): peças entre o gancho e a carga.
//
// Entram no peso comparado com a capacidade (o BACKEND soma; RN-008) e na distância entre o gancho e
// a carga (`riggingHeightM`, só desenho). Jib e contrapeso não são acessórios: são configurações.
// Valores FICTÍCIOS e configuráveis (ADR-012).

export const ACCESSORY_TYPES = [
  'HOOK_BLOCK',
  'OVERHAUL_BALL',
  'SWIVEL_HOOK',
  'SHACKLE',
  'WIRE_ROPE_SLING',
  'CHAIN_SLING',
  'POLYESTER_SLING',
  'SPREADER_BEAM',
  'CRANE_MAT',
] as const

export type AccessoryType = (typeof ACCESSORY_TYPES)[number]

export const ACCESSORY_TYPE_LABELS: Readonly<Record<AccessoryType, string>> = {
  HOOK_BLOCK: 'Moitão / gancho',
  OVERHAUL_BALL: 'Bola de peso',
  SWIVEL_HOOK: 'Gancho giratório',
  SHACKLE: 'Manilha',
  WIRE_ROPE_SLING: 'Linga de cabo de aço',
  CHAIN_SLING: 'Linga de corrente',
  POLYESTER_SLING: 'Cinta de poliéster',
  SPREADER_BEAM: 'Balancim / viga espaçadora',
  CRANE_MAT: 'Tapete de patola',
}

/** Máximo de acessórios por avaliação (o backend recusa mais que isso com 422). */
export const MAX_SELECTED_ACCESSORIES = 20

/** Acessório do catálogo, como o backend o devolve. */
export interface Accessory {
  readonly id: string
  readonly type: AccessoryType
  readonly name: string
  readonly weightKg: number
  /** Quanto o acessório afasta a carga abaixo do gancho, em metros. */
  readonly riggingHeightM: number
  /** Nome do arquivo em `public/models/acessorios/`, ou `null` com o modelo 3D pendente. */
  readonly modelFile: string | null
  readonly credit: string | null
  readonly license: string | null
}

/** Campos de um cadastro novo (o `id` é gerado pelo backend). */
export type NewAccessory = Omit<Accessory, 'id'>

/** Alteração parcial; `modelFile`, `credit` e `license` aceitam `null` para apagar. */
export type AccessoryChanges = Partial<NewAccessory>

export function isAccessoryType(value: unknown): value is AccessoryType {
  return typeof value === 'string' && (ACCESSORY_TYPES as readonly string[]).includes(value)
}

/** Pasta pública dos modelos 3D de acessórios (ADR-026). */
export const ACCESSORY_MODELS_PATH = '/models/acessorios'

/** URL do modelo 3D do acessório, ou `null` com o modelo pendente. */
export function accessoryModelUrl(accessory: Pick<Accessory, 'modelFile'>): string | null {
  return accessory.modelFile === null
    ? null
    : `${ACCESSORY_MODELS_PATH}/${encodeURIComponent(accessory.modelFile)}`
}

/** Soma dos `riggingHeightM`: quanto a carga desce abaixo do gancho pela cadeia (m). */
export function accessoriesRiggingHeightM(
  accessories: readonly Pick<Accessory, 'riggingHeightM'>[],
): number {
  return accessories.reduce(
    (total, item) => (Number.isFinite(item.riggingHeightM) ? total + item.riggingHeightM : total),
    0,
  )
}

/** Soma dos pesos (kg), só para a pré-visualização: quem compara com a capacidade é o backend. */
export function accessoriesWeightKg(accessories: readonly Pick<Accessory, 'weightKg'>[]): number {
  return accessories.reduce((total, item) => total + item.weightKg, 0)
}
