// Biblioteca de objetos reais do editor 3D do ambiente (TASK-072; ADR-036): árvores, moitas, casas,
// barracões, veículos, contêiner e um guindaste estacionado, todos em escala real (metros). Só dados e
// funções puras, sem Three.js: a cena (`three/scene/ObstacleMeshes`) desenha os GLBs e o domínio das
// colisões (`domain/collision`) usa as caixas daqui.
//
// Referencial do objeto: origem no centro da planta, base em y = 0, Y para cima; a "frente" do barracão
// (a abertura) fica em +Z. `baseSize` é o tamanho do modelo como o GLB é desenhado (m). O obstáculo do
// cenário guarda o tamanho em `widthM` (x), `depthM` (z) e `heightM` (y); a escala de cada eixo é o
// tamanho do obstáculo dividido pelo `baseSize`, e as caixas de colisão escalam junto.
//
// Modelos: kits CC0 da Kenney (https://kenney.nl) e o barracão aberto, gerado por código. Os GLBs vêm
// de `frontend/scripts/build-object-library.mjs` (créditos em `public/models/objetos/CREDITS.md`). As
// caixas são aproximações para pré-visualização: capacidade e segurança são do backend (RN-008).

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

export interface LibraryObject {
  readonly id: string
  readonly label: string
  readonly category: ObjectCategory
  /** Arquivo GLB relativo a `public/models/`. */
  readonly file: string
  readonly baseSize: ObjectSize
  readonly collision: readonly CollisionBox[]
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

// --- Barracão aberto ------------------------------------------------------------------------------
// Mesmas medidas do gerador (`scripts/build-object-library.mjs`, constante SHED); um teste confere o
// tamanho do GLB. A frente (a porta) fica em +Z.

const SHED = {
  width: 14,
  depth: 18,
  wall: 0.4,
  wallHeight: 7,
  ridgeHeight: 8.8,
  doorWidth: 8,
  doorHeight: 6,
  roofStrips: 6,
} as const

function shedBoxes(): readonly CollisionBox[] {
  const { width, depth, wall, wallHeight, ridgeHeight, doorWidth, doorHeight } = SHED
  const hx = width / 2
  const hz = depth / 2
  const hd = doorWidth / 2
  const boxes: CollisionBox[] = [
    { x: 0, z: -hz + wall / 2, y: 0, w: width, d: wall, h: wallHeight }, // fundo
    { x: -hx + wall / 2, z: wall / 2, y: 0, w: wall, d: depth - wall, h: wallHeight }, // esquerda
    { x: hx - wall / 2, z: wall / 2, y: 0, w: wall, d: depth - wall, h: wallHeight }, // direita
    // Frente: dois pilares e a verga; entre eles fica a porta.
    {
      x: -(hd + hx - wall) / 2,
      z: hz - wall / 2,
      y: 0,
      w: hx - wall - hd,
      d: wall,
      h: wallHeight,
    },
    {
      x: (hd + hx - wall) / 2,
      z: hz - wall / 2,
      y: 0,
      w: hx - wall - hd,
      d: wall,
      h: wallHeight,
    },
    { x: 0, z: hz - wall / 2, y: doorHeight, w: doorWidth, d: wall, h: wallHeight - doorHeight },
  ]
  // Telhado de duas águas como massa sólida do forro (y = altura do beiral) até a água, em degraus: a
  // carga e o gancho não atravessam o teto de cima para baixo, e a carga entra pela porta por baixo
  // dele. A faixa `i` cobre o trecho da água entre as distâncias `near` e `far` do eixo.
  const rise = ridgeHeight - wallHeight
  const stripWidth = hx / SHED.roofStrips
  const surface = (distance: number): number => wallHeight + rise * (1 - distance / hx)
  for (let i = 0; i < SHED.roofStrips; i += 1) {
    const near = i * stripWidth
    const far = (i + 1) * stripWidth
    for (const side of [-1, 1]) {
      boxes.push({
        x: round2(side * ((near + far) / 2)),
        z: 0,
        y: wallHeight,
        w: round2(stripWidth),
        d: depth,
        h: round2(surface(near) - wallHeight),
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
const SHED_SIZE: ObjectSize = { w: SHED.width, d: SHED.depth, h: SHED.ridgeHeight }
const CONTAINER: ObjectSize = { w: 2.72, d: 6, h: 2.54 }
const TRUCK: ObjectSize = { w: 4.05, d: 7.96, h: 3.51 }
const TRUCK_FLAT: ObjectSize = { w: 4.05, d: 7.41, h: 3.51 }
const TRUCK_BOX: ObjectSize = { w: 3.6, d: 7.8, h: 3.96 }
const SEDAN: ObjectSize = { w: 2.62, d: 4.46, h: 2.27 }
const SUV: ObjectSize = { w: 2.55, d: 4.59, h: 2.21 }
const VAN: ObjectSize = { w: 2.85, d: 5.23, h: 2.56 }
const PARKED_CRANE: ObjectSize = { w: 6.2, d: 18.88, h: 4.57 }

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
    label: 'Barracão com porta aberta',
    category: 'edificacao',
    file: 'objetos/barracao-aberto.glb',
    baseSize: SHED_SIZE,
    collision: shedBoxes(),
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
    collision: vehicle(TRUCK_FLAT, [
      [0, 0.5, 0.53, 1],
      [0.5, 0.8, 1, 0.9],
      [0.8, 1, 0.62, 1],
    ]),
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
    widthM: object.baseSize.w,
    depthM: object.baseSize.d,
    heightM: object.baseSize.h,
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
