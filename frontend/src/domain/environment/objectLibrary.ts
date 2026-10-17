// Biblioteca de objetos reais do editor 3D do ambiente (TASK-072; ADR-036): árvores, moitas, casas,
// galpões, veículos, contêiner e um guindaste estacionado, todos em escala real (metros). Só dados e
// funções puras, sem Three.js: a cena (`three/scene/ObstacleMeshes`) desenha os GLBs e o domínio das
// colisões (`domain/collision`) usa as caixas daqui.
//
// Referencial do objeto: origem no centro da planta, base em y = 0, Y para cima; a "frente" do galpão
// (a abertura) fica em +Z. `baseSize` é o tamanho do modelo como o GLB é desenhado (m). O obstáculo do
// cenário guarda o tamanho em `widthM` (x), `depthM` (z) e `heightM` (y); a escala de cada eixo é o
// tamanho do obstáculo dividido pelo `baseSize`, e as caixas de colisão escalam junto.
//
// Modelos: kits CC0 da Kenney (https://kenney.nl), de `frontend/scripts/build-object-library.mjs`, e o
// galpão com a frente aberta, o hangar de nermin (CC BY 4.0), de `scripts/build-sketchfab-models.mjs`
// (créditos em `public/models/objetos/CREDITS.md`). As caixas são aproximações para pré-visualização:
// capacidade e segurança são do backend (RN-008).

import type { Obstacle } from './environment'

export type ObjectCategory = 'vegetacao' | 'edificacao' | 'veiculo' | 'guindaste' | 'outro'

export const OBJECT_CATEGORIES: readonly ObjectCategory[] = [
  'vegetacao',
  'edificacao',
  'veiculo',
  'guindaste',
  'outro',
]

export const OBJECT_CATEGORY_LABELS: Readonly<Record<ObjectCategory, string>> = {
  vegetacao: 'Vegetação',
  edificacao: 'Construções',
  veiculo: 'Veículos',
  guindaste: 'Guindastes',
  outro: 'Outros',
}

/**
 * Caixa de colisão no referencial do objeto: centro em (`x`, `z`) no plano da planta, base em `y` (m
 * acima da base do objeto) e tamanhos `w` (em x), `d` (em z) e `h` (em y).
 */
export interface CollisionBox {
  readonly x: number
  readonly z: number
  readonly y: number
  readonly w: number
  readonly d: number
  readonly h: number
}

export interface ObjectSize {
  readonly w: number
  readonly d: number
  readonly h: number
}

/**
 * O que se sabe da capacidade de carga de uma superfície de apoio (TASK-108; ADR-052). Sem dado
 * (`capacityKg` ausente) o apoio é FICTÍCIO: o peso apoiado não é conferido e a interface e o plano
 * dizem isso. `source` cita de onde vem o número, ou o rótulo FICTÍCIO.
 */
export interface LoadBedInfo {
  /** Capacidade (kg) de carga apoiada em cima, SE houver dado; ausente = sem dado. */
  readonly capacityKg?: number
  readonly source: string
}

/** Rótulo de um apoio sem capacidade conhecida. */
export const NO_CAPACITY_SOURCE =
  'FICTÍCIO: sem dado de capacidade para carga apoiada neste objeto; o peso apoiado não é conferido'

/** `loadBedInfo` de um apoio que não declarou dado: FICTÍCIO. */
const FICTITIOUS_BED: LoadBedInfo = { source: NO_CAPACITY_SOURCE }

export interface LibraryObject {
  readonly id: string
  readonly label: string
  readonly category: ObjectCategory
  /** Arquivo GLB relativo a `public/models/`. */
  readonly file: string
  readonly baseSize: ObjectSize
  readonly collision: readonly CollisionBox[]
  /**
   * Superfície onde a carga pode ser solta (TASK-101; ADR-052): a carroceria do caminhão plataforma, o
   * convés da carreta prancha e o teto dos contêineres. É uma das caixas de `collision`; o topo dela
   * (`y + h`) é a altura de apoio. Só quem declara recebe carga.
   */
  readonly loadBed?: CollisionBox
  /** Capacidade conhecida do apoio (só com `loadBed`); sem ele o apoio é FICTÍCIO (`NO_CAPACITY_SOURCE`). */
  readonly loadBedInfo?: LoadBedInfo
  /**
   * Tamanho (m) com que o objeto entra no cenário quando é posto pela paleta, se diferente do `baseSize`
   * (o do arquivo): o contêiner de 40 pés usa o mesmo GLB esticado até a medida ISO. A escala do
   * obstáculo é o tamanho dele ÷ `baseSize`, então `collision` e `loadBed` seguem no referencial do GLB.
   */
  readonly defaultSize?: ObjectSize
  /**
   * Deslocamento (m) a aplicar ao modelo carregado para que o centro da planta fique na origem; só
   * para um GLB que não foi gerado já centrado (o guindaste estacionado).
   */
  readonly modelOffset?: { readonly x: number; readonly z: number }
}

const round2 = (value: number): number => Math.round(value * 100) / 100

/** Uma caixa que cobre a planta inteira e a altura toda, com a margem `shrink` (fração) nas laterais. */
function solid(size: ObjectSize, shrink = 0): readonly CollisionBox[] {
  return [
    {
      x: 0,
      z: 0,
      y: 0,
      w: round2(size.w * (1 - shrink)),
      d: round2(size.d * (1 - shrink)),
      h: size.h,
    },
  ]
}

/**
 * Camadas empilhadas (copa de árvore, por exemplo): cada `[de, até, largura]` é uma faixa de altura e a
 * largura da planta, todas em fração do tamanho. Mais o tronco, uma caixa estreita de baixo até o topo
 * das camadas.
 */
function layered(
  size: ObjectSize,
  trunkM: number,
  layers: readonly (readonly [number, number, number])[],
): readonly CollisionBox[] {
  const boxes: CollisionBox[] = layers.map(([from, to, width]) => ({
    x: 0,
    z: 0,
    y: round2(size.h * from),
    w: round2(size.w * width),
    d: round2(size.d * width),
    h: round2(size.h * (to - from)),
  }))
  const top = Math.max(...layers.map(([, to]) => to))
  boxes.unshift({
    x: 0,
    z: 0,
    y: 0,
    w: trunkM,
    d: trunkM,
    h: round2(size.h * top),
  })
  return boxes
}

/**
 * Veículo em trechos ao longo do comprimento (de trás, em -Z, para a frente, em +Z): cada
 * `[de, até, altura, largura]` é uma faixa do comprimento e a altura e a largura dela, em fração do
 * tamanho. Assim a caçamba de uma picape fica baixa e a carga pode pousar nela, enquanto a cabine é
 * alta. A frente do veículo é +Z.
 */
function vehicle(
  size: ObjectSize,
  parts: readonly (readonly [number, number, number, number])[],
): readonly CollisionBox[] {
  return parts.map(([from, to, height, width]) => ({
    x: 0,
    z: round2(size.d * ((from + to) / 2 - 0.5)),
    y: 0,
    w: round2(size.w * width),
    d: round2(size.d * (to - from)),
    h: round2(size.h * height),
  }))
}

// --- Galpão com a frente aberta ---------------------------------------------------------------------
// Hangar de nermin (CC BY 4.0), em arco, sem o pano da frente: a abertura fica em +Z e o fundo (-Z)
// fecha. Medidas do GLB gerado por `scripts/build-sketchfab-models.mjs`; um teste confere o tamanho. O
// arco é um semicírculo de raio `HANGAR.radius` (largura 16,4 m, altura 8,2 m); a casca é fina
// (`HANGAR.shell`). A calçada em volta (0,2 m de altura) não colide.

const HANGAR = {
  /** Raio do arco = metade da largura do corpo (m). */
  radius: 8.2,
  /** Espessura da casca (m). */
  shell: 0.3,
  /** Comprimento do corpo (m); a calçada do GLB passa 1,9 m de cada ponta. */
  length: 23.52,
  /** Faixas do arco por lado, do eixo à parede. */
  strips: 10,
  /** Faixas do fundo por lado. */
  backStrips: 5,
} as const

/** Limites (m a partir do eixo) das faixas de um lado do arco: `raio * sen(ângulo)`, do eixo à parede. */
function archEdges(count: number): readonly number[] {
  return Array.from({ length: count + 1 }, (_, i) =>
    round2(HANGAR.radius * Math.sin(((i / count) * Math.PI) / 2)),
  )
}

function hangarBoxes(): readonly CollisionBox[] {
  const { radius, shell, length, strips, backStrips } = HANGAR
  const inner = radius - shell
  const outerAt = (x: number): number => Math.sqrt(Math.max(0, radius * radius - x * x))
  const innerAt = (x: number): number => (x >= inner ? 0 : Math.sqrt(inner * inner - x * x))
  const boxes: CollisionBox[] = []
  // Casca em arco: de cada faixa, a massa entre a face de dentro (a mais baixa, na borda de fora da
  // faixa) e a de fora (no meio dela). A carga e o gancho não atravessam o teto nem as paredes, e a
  // carga entra pela abertura da frente (+Z).
  const edges = archEdges(strips)
  for (let i = 0; i < strips; i += 1) {
    const near = edges[i]!
    const far = edges[i + 1]!
    const bottom = round2(innerAt(far))
    const top = round2(outerAt((near + far) / 2))
    for (const side of [-1, 1]) {
      boxes.push({
        x: round2((side * (near + far)) / 2),
        z: 0,
        y: bottom,
        w: round2(far - near),
        d: length,
        h: round2(top - bottom),
      })
    }
  }
  // Fundo fechado: o arco cheio, numa parede de `shell` de espessura.
  const backEdges = archEdges(backStrips)
  for (let i = 0; i < backStrips; i += 1) {
    const near = backEdges[i]!
    const far = backEdges[i + 1]!
    for (const side of [-1, 1]) {
      boxes.push({
        x: round2((side * (near + far)) / 2),
        z: round2(-length / 2 + shell / 2),
        y: 0,
        w: round2(far - near),
        d: shell,
        h: round2(outerAt((near + far) / 2)),
      })
    }
  }
  return boxes
}

// --- Guindaste estacionado ------------------------------------------------------------------------
// O GLB do guindaste de 80 t na pose de repouso (lança horizontal e recolhida, +Z para a frente), como
// obstáculo. Caixas medidas nos nós do arquivo e levadas ao centro da planta (z - 4,31 m).

const CRANE_CENTER_Z = 4.31

const PARKED_CRANE_BOXES: readonly CollisionBox[] = [
  { x: 0, z: round2(2.045 - CRANE_CENTER_Z), y: 0, w: 3.84, d: 14.35, h: 3.22 }, // chassi
  { x: 0.52, z: round2(-0.72 - CRANE_CENTER_Z), y: 2.05, w: 3.79, d: 6.92, h: 2.52 }, // superestrutura
  { x: 0.22, z: round2(7.1 - CRANE_CENTER_Z), y: 2.56, w: 1.85, d: 13.29, h: 1.8 }, // lança
  { x: 0.25, z: round2(12.62 - CRANE_CENTER_Z), y: 1.33, w: 1.78, d: 2.27, h: 3.03 }, // cabeça e moitão
  { x: 0, z: round2(-2.51 - CRANE_CENTER_Z), y: 0.5, w: 6.2, d: 1.32, h: 1.06 }, // patolas de trás
  { x: 0, z: round2(4.43 - CRANE_CENTER_Z), y: 0.5, w: 6.2, d: 1.32, h: 1.06 }, // patolas da frente
]

// --- Catálogo -------------------------------------------------------------------------------------

const TREE_OAK: ObjectSize = { w: 4.16, d: 4.81, h: 7.97 }
const TREE_PINE: ObjectSize = { w: 3.09, d: 3.09, h: 8.97 }
const TREE_ROUND: ObjectSize = { w: 3.4, d: 2.94, h: 7.69 }
const TREE_PALM: ObjectSize = { w: 6.72, d: 6.72, h: 8.81 }
const BUSH_LARGE: ObjectSize = { w: 2.81, d: 2.52, h: 1.82 }
const BUSH: ObjectSize = { w: 1.98, d: 1.98, h: 1.22 }
const HOUSE_A: ObjectSize = { w: 7.02, d: 5.55, h: 4.5 }
const HOUSE_D: ObjectSize = { w: 8.08, d: 4.73, h: 5.69 }
const WAREHOUSE: ObjectSize = { w: 11.82, d: 14.95, h: 8.44 }
const HANGAR_SIZE: ObjectSize = { w: 19.22, d: 27.44, h: 8.27 }
const CONTAINER: ObjectSize = { w: 2.72, d: 6, h: 2.54 }
/** Contêineres ISO 668 (medidas externas): 8 pés de largura, 8,5 pés de altura (9,5 no high cube). */
const ISO_CONTAINER_20: ObjectSize = { w: 2.438, d: 6.058, h: 2.591 }
const ISO_CONTAINER_40: ObjectSize = { w: 2.438, d: 12.192, h: 2.591 }
const ISO_CONTAINER_40_HC: ObjectSize = { w: 2.438, d: 12.192, h: 2.896 }
/**
 * Carreta prancha de 3 eixos (semirreboque plano): convés de 2,6 m x 13 m a 1,5 m do chão. Medidas
 * típicas, FICTÍCIAS (não são de um fabricante); o GLB é gerado por `scripts/build-carreta-prancha.mjs`.
 */
const FLATBED_TRAILER: ObjectSize = { w: 2.6, d: 13, h: 1.5 }
const TRUCK: ObjectSize = { w: 4.05, d: 7.96, h: 3.51 }
const TRUCK_FLAT: ObjectSize = { w: 4.05, d: 7.41, h: 3.51 }
const TRUCK_BOX: ObjectSize = { w: 3.6, d: 7.8, h: 3.96 }
const SEDAN: ObjectSize = { w: 2.62, d: 4.46, h: 2.27 }
const SUV: ObjectSize = { w: 2.55, d: 4.59, h: 2.21 }
const VAN: ObjectSize = { w: 2.85, d: 5.23, h: 2.56 }
const PARKED_CRANE: ObjectSize = { w: 6.2, d: 18.88, h: 4.57 }

/** Trechos do caminhão plataforma: a carroceria (traseira, 0,53 da altura) vem primeiro. */
const TRUCK_FLAT_COLLISION = vehicle(TRUCK_FLAT, [
  [0, 0.5, 0.53, 1],
  [0.5, 0.8, 1, 0.9],
  [0.8, 1, 0.62, 1],
])

export const OBJECT_LIBRARY: readonly LibraryObject[] = [
  {
    id: 'arvore-carvalho',
    label: 'Árvore (carvalho)',
    category: 'vegetacao',
    file: 'objetos/arvore-carvalho.glb',
    baseSize: TREE_OAK,
    collision: layered(TREE_OAK, 0.8, [[0.3, 1, 1]]),
  },
  {
    id: 'pinheiro',
    label: 'Pinheiro',
    category: 'vegetacao',
    file: 'objetos/pinheiro.glb',
    baseSize: TREE_PINE,
    collision: layered(TREE_PINE, 0.6, [
      [0.15, 0.45, 1],
      [0.45, 0.72, 0.65],
      [0.72, 1, 0.3],
    ]),
  },
  {
    id: 'arvore-copa-redonda',
    label: 'Árvore (copa redonda)',
    category: 'vegetacao',
    file: 'objetos/arvore-copa-redonda.glb',
    baseSize: TREE_ROUND,
    collision: layered(TREE_ROUND, 0.7, [[0.3, 1, 1]]),
  },
  {
    id: 'palmeira',
    label: 'Palmeira',
    category: 'vegetacao',
    file: 'objetos/palmeira.glb',
    baseSize: TREE_PALM,
    collision: layered(TREE_PALM, 0.6, [[0.72, 1, 1]]),
  },
  {
    id: 'moita-grande',
    label: 'Moita grande',
    category: 'vegetacao',
    file: 'objetos/moita-grande.glb',
    baseSize: BUSH_LARGE,
    collision: solid(BUSH_LARGE),
  },
  {
    id: 'moita',
    label: 'Moita',
    category: 'vegetacao',
    file: 'objetos/moita.glb',
    baseSize: BUSH,
    collision: solid(BUSH),
  },
  {
    id: 'casa-terrea',
    label: 'Casa térrea',
    category: 'edificacao',
    file: 'objetos/casa-terrea.glb',
    baseSize: HOUSE_A,
    collision: solid(HOUSE_A),
  },
  {
    id: 'casa-sobrado',
    label: 'Sobrado',
    category: 'edificacao',
    file: 'objetos/casa-sobrado.glb',
    baseSize: HOUSE_D,
    collision: solid(HOUSE_D),
  },
  {
    id: 'galpao-fechado',
    label: 'Galpão fechado',
    category: 'edificacao',
    file: 'objetos/galpao-fechado.glb',
    baseSize: WAREHOUSE,
    collision: solid(WAREHOUSE),
  },
  {
    id: 'barracao-aberto',
    label: 'Galpão com frente aberta',
    category: 'edificacao',
    file: 'objetos/barracao-aberto.glb',
    baseSize: HANGAR_SIZE,
    collision: hangarBoxes(),
  },
  {
    id: 'caminhao',
    label: 'Caminhão',
    category: 'veiculo',
    file: 'objetos/caminhao.glb',
    baseSize: TRUCK,
    collision: vehicle(TRUCK, [
      [0, 0.4, 0.62, 1],
      [0.4, 0.7, 1, 0.9],
      [0.7, 1, 0.62, 1],
    ]),
  },
  {
    id: 'caminhao-plataforma',
    label: 'Caminhão plataforma',
    category: 'veiculo',
    file: 'objetos/caminhao-plataforma.glb',
    baseSize: TRUCK_FLAT,
    collision: TRUCK_FLAT_COLLISION,
    loadBed: TRUCK_FLAT_COLLISION[0],
    loadBedInfo: FICTITIOUS_BED,
  },
  {
    id: 'caminhao-bau',
    label: 'Caminhão baú',
    category: 'veiculo',
    file: 'objetos/caminhao-bau.glb',
    baseSize: TRUCK_BOX,
    collision: vehicle(TRUCK_BOX, [
      [0, 0.45, 1, 1],
      [0.45, 0.8, 0.95, 0.95],
      [0.8, 1, 0.5, 1],
    ]),
  },
  {
    id: 'sedan',
    label: 'Carro (sedã)',
    category: 'veiculo',
    file: 'objetos/sedan.glb',
    baseSize: SEDAN,
    collision: vehicle(SEDAN, [
      [0, 0.2, 0.54, 1],
      [0.2, 0.6, 1, 0.88],
      [0.6, 1, 0.62, 1],
    ]),
  },
  {
    id: 'suv',
    label: 'Carro (utilitário)',
    category: 'veiculo',
    file: 'objetos/suv.glb',
    baseSize: SUV,
    collision: vehicle(SUV, [
      [0, 0.7, 1, 0.95],
      [0.7, 1, 0.62, 1],
    ]),
  },
  {
    id: 'van',
    label: 'Van',
    category: 'veiculo',
    file: 'objetos/van.glb',
    baseSize: VAN,
    collision: vehicle(VAN, [
      [0, 0.75, 1, 0.95],
      [0.75, 1, 0.6, 1],
    ]),
  },
  {
    id: 'guindaste-estacionado',
    label: 'Guindaste estacionado',
    category: 'guindaste',
    file: 'guindaste-80t.glb',
    baseSize: PARKED_CRANE,
    collision: PARKED_CRANE_BOXES,
    modelOffset: { x: 0, z: -CRANE_CENTER_Z },
  },
  {
    id: 'conteiner',
    label: 'Contêiner',
    category: 'outro',
    file: 'objetos/conteiner.glb',
    baseSize: CONTAINER,
    collision: solid(CONTAINER),
    loadBed: solid(CONTAINER)[0],
    loadBedInfo: FICTITIOUS_BED,
  },
  ...(
    [
      ['conteiner-20', "Contêiner 20' (ISO)", ISO_CONTAINER_20],
      ['conteiner-40', "Contêiner 40' (ISO)", ISO_CONTAINER_40],
      ['conteiner-40hc', "Contêiner 40' high cube (ISO)", ISO_CONTAINER_40_HC],
    ] as const
  ).map(([id, label, size]): LibraryObject => ({
    id,
    label,
    category: 'outro',
    // O mesmo GLB do contêiner genérico, esticado até a medida ISO (`defaultSize`): o teto é plano.
    file: 'objetos/conteiner.glb',
    baseSize: CONTAINER,
    defaultSize: size,
    collision: solid(CONTAINER),
    loadBed: solid(CONTAINER)[0],
    loadBedInfo: FICTITIOUS_BED,
  })),
  {
    id: 'carreta-prancha',
    label: 'Carreta prancha',
    category: 'veiculo',
    file: 'objetos/carreta-prancha.glb',
    baseSize: FLATBED_TRAILER,
    collision: solid(FLATBED_TRAILER),
    loadBed: solid(FLATBED_TRAILER)[0],
    loadBedInfo: FICTITIOUS_BED,
  },
]

const BY_ID: ReadonlyMap<string, LibraryObject> = new Map(
  OBJECT_LIBRARY.map((object) => [object.id, object]),
)

/** Objeto da biblioteca pelo id, ou `undefined` (id desconhecido, de um cenário de outra versão). */
export function findLibraryObject(id: string | undefined): LibraryObject | undefined {
  return id === undefined ? undefined : BY_ID.get(id)
}

/** Objetos de uma categoria, na ordem da biblioteca. */
export function libraryObjectsIn(category: ObjectCategory): readonly LibraryObject[] {
  return OBJECT_LIBRARY.filter((object) => object.category === category)
}

/** Categorias que têm pelo menos um objeto, na ordem de `OBJECT_CATEGORIES`. */
export function usedCategories(): readonly ObjectCategory[] {
  return OBJECT_CATEGORIES.filter((category) =>
    OBJECT_LIBRARY.some((object) => object.category === category),
  )
}

/** Dados do obstáculo novo (tamanho real, sem escala) de um objeto da biblioteca. */
export function newModelObstacle(
  object: LibraryObject,
  id: string,
  label: string,
): Pick<
  Obstacle,
  'id' | 'label' | 'kind' | 'modelId' | 'widthM' | 'depthM' | 'heightM' | 'rotationYDeg'
> {
  return {
    id,
    label,
    kind: 'model',
    modelId: object.id,
    widthM: (object.defaultSize ?? object.baseSize).w,
    depthM: (object.defaultSize ?? object.baseSize).d,
    heightM: (object.defaultSize ?? object.baseSize).h,
    rotationYDeg: 0,
  }
}

/** Escala por eixo do obstáculo em relação ao tamanho do modelo (1 = tamanho real da biblioteca). */
export function modelScale(
  obstacle: Pick<Obstacle, 'widthM' | 'depthM' | 'heightM'>,
  object: LibraryObject,
): { readonly x: number; readonly y: number; readonly z: number } {
  return {
    x: obstacle.widthM / object.baseSize.w,
    y: obstacle.heightM / object.baseSize.h,
    z: obstacle.depthM / object.baseSize.d,
  }
}

/** Caixas de colisão do objeto já escaladas para o tamanho do obstáculo (referencial do objeto). */
export function scaledCollisionBoxes(
  obstacle: Pick<Obstacle, 'widthM' | 'depthM' | 'heightM'>,
  object: LibraryObject,
): readonly CollisionBox[] {
  const scale = modelScale(obstacle, object)
  return object.collision.map((box) => ({
    x: box.x * scale.x,
    z: box.z * scale.z,
    y: box.y * scale.y,
    w: box.w * scale.x,
    d: box.d * scale.z,
    h: box.h * scale.y,
  }))
}

/** A superfície de carga do objeto (`loadBed`) já escalada para o tamanho do obstáculo. */
export function scaledLoadBed(
  obstacle: Pick<Obstacle, 'widthM' | 'depthM' | 'heightM'>,
  object: LibraryObject,
): CollisionBox | undefined {
  const bed = object.loadBed
  if (!bed) return undefined
  const scale = modelScale(obstacle, object)
  return {
    x: bed.x * scale.x,
    z: bed.z * scale.z,
    y: bed.y * scale.y,
    w: bed.w * scale.x,
    d: bed.d * scale.z,
    h: bed.h * scale.y,
  }
}
