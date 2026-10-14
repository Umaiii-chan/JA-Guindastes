// Tipos de carga do passo "Carga" (leva F): cada tipo, exceto a caixa simples, tem um modelo 3D real
// (CC BY 4.0, créditos em `public/models/cargas/CREDITS.md`) que a cena escala para as medidas
// digitadas e desenha no lugar da caixa. Só dados e funções puras, sem Three.js. O tipo é só desenho:
// o peso e as medidas da carga continuam sendo os digitados, e a colisão continua pela caixa da carga
// (RN-008).
//
// Referencial do modelo: origem no centro da planta, base em y = 0; a largura fica em X, a altura em Y
// e o comprimento em Z, como a caixa da carga (`domain/collision/loadBox`). `baseSize` é o tamanho do
// modelo como o GLB é desenhado (m), gerado por `scripts/build-sketchfab-models.mjs`.

export type CargoTypeId =
  | 'caixa'
  | 'conteiner'
  | 'viga-concreto'
  | 'viga-concreto-calha'
  | 'feixe-tubos'
  | 'gerador'
  | 'transformador'
  | 'caixa-madeira'

export interface CargoModelSize {
  readonly w: number
  readonly d: number
  readonly h: number
}

export interface CargoType {
  readonly id: CargoTypeId
  readonly label: string
  /** Arquivo GLB relativo a `public/models/`; ausente na caixa simples. */
  readonly file?: string
  readonly baseSize?: CargoModelSize
}

/** A caixa simples: o padrão, sem modelo. */
export const DEFAULT_CARGO_TYPE: CargoTypeId = 'caixa'

export const CARGO_TYPES: readonly CargoType[] = [
  { id: 'caixa', label: 'Caixa simples' },
  {
    id: 'conteiner',
    label: 'Contêiner',
    file: 'cargas/conteiner.glb',
    baseSize: { w: 2.4, d: 6.01, h: 2.9 },
  },
  {
    id: 'viga-concreto',
    label: 'Viga de concreto',
    file: 'cargas/viga-concreto-tubgirder.glb',
    baseSize: { w: 2.25, d: 12.2, h: 2.1 },
  },
  {
    id: 'viga-concreto-calha',
    label: 'Viga de concreto (calha)',
    file: 'cargas/viga-concreto-canal.glb',
    baseSize: { w: 1.81, d: 12.2, h: 0.92 },
  },
  {
    id: 'feixe-tubos',
    label: 'Feixe de tubos',
    file: 'cargas/feixe-tubos.glb',
    baseSize: { w: 0.55, d: 2.86, h: 1.67 },
  },
  {
    id: 'gerador',
    label: 'Gerador',
    file: 'cargas/gerador-diesel.glb',
    baseSize: { w: 0.69, d: 1.41, h: 1.06 },
  },
  {
    id: 'transformador',
    label: 'Transformador',
    file: 'cargas/transformador.glb',
    baseSize: { w: 2.55, d: 4.93, h: 5.09 },
  },
  {
    id: 'caixa-madeira',
    label: 'Caixa de madeira',
    file: 'cargas/caixa-madeira.glb',
    baseSize: { w: 1.1, d: 1.1, h: 0.88 },
  },
]

const BY_ID: ReadonlyMap<string, CargoType> = new Map(CARGO_TYPES.map((type) => [type.id, type]))

/** Tipo pelo id, ou `undefined` (id desconhecido, de um rascunho ou gravação de outra versão). */
export function findCargoType(id: string | undefined | null): CargoType | undefined {
  return id === undefined || id === null ? undefined : BY_ID.get(id)
}

/** Tipo com modelo 3D pelo id; a caixa simples e ids desconhecidos não têm (`undefined`). */
export function findCargoModelType(id: string | undefined | null): CargoType | undefined {
  const type = findCargoType(id)
  return type?.file === undefined ? undefined : type
}

/** O id, se for de um tipo conhecido e diferente do padrão; `undefined` caso contrário. */
export function normalizeCargoType(id: string | undefined | null): CargoTypeId | undefined {
  const type = findCargoType(id)
  return type === undefined || type.id === DEFAULT_CARGO_TYPE ? undefined : type.id
}

/** Escala por eixo do modelo para chegar às medidas da carga (largura em X, altura em Y, comprimento em Z). */
export function cargoModelScale(
  type: CargoType,
  load: { readonly lengthM: number; readonly widthM: number; readonly heightM: number },
): { readonly x: number; readonly y: number; readonly z: number } | null {
  const base = type.baseSize
  if (!base) return null
  return { x: load.widthM / base.w, y: load.heightM / base.h, z: load.lengthM / base.d }
}
