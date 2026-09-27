// Caixa da carga pendurada no gancho (TASK-041), sem Three.js.
//
// É só desenho: o peso da carga e a capacidade ficam no backend (RN-008). As medidas vêm da UI.
// As coordenadas são locais do nó do gancho (origem no ponto de suspensão G, ADR-013 C-5): o cabo
// pende na vertical (S-2), então o −Y local é "para baixo" e o +Z local segue a direção horizontal
// da lança (o nó do cabo compensa a inclinação da lança; ver `CraneController`).

/** Medidas da carga em metros. Comprimento na direção da lança, largura na transversal. */
export interface LoadDimensions {
  readonly lengthM: number
  readonly widthM: number
  readonly heightM: number
}

export interface LocalPoint {
  readonly x: number
  readonly y: number
  readonly z: number
}

/** Caixa já posicionada abaixo do gancho, com os pontos das lingas. */
export interface LoadBoxLayout {
  /** Tamanho da caixa nos eixos locais (x = largura, y = altura, z = comprimento). */
  readonly size: LocalPoint
  /** Centro da caixa. */
  readonly center: LocalPoint
  /** Onde as lingas se juntam, na curva do gancho. */
  readonly slingTop: LocalPoint
  /** Os quatro cantos de cima da caixa, onde as lingas prendem. */
  readonly slingBottoms: readonly LocalPoint[]
}

/**
 * Onde as lingas se prendem (m abaixo de G) quando não há medida do gancho: a curva do gancho do
 * modelo provisório vai de −0,65 a −1,1 m (`createProvisionalCrane`). A cena mede o gancho do rig em
 * uso (`HookLoad`, com `measureHookExtent`) e passa o valor medido a `computeLoadBox`.
 */
export const HOOK_ATTACH_OFFSET_M = 1.05

/** Altura das lingas entre o gancho e o topo da carga: metade do maior lado, entre 0,6 e 3 m. */
export function slingDropM(load: LoadDimensions): number {
  const half = Math.max(load.lengthM, load.widthM) / 2
  return Math.min(3, Math.max(0.6, half))
}

/** `true` se as três medidas forem números finitos maiores que zero. */
export function isValidLoad(load: LoadDimensions | null | undefined): load is LoadDimensions {
  if (!load) return false
  return [load.lengthM, load.widthM, load.heightM].every(
    (value) => Number.isFinite(value) && value > 0,
  )
}

/**
 * Caixa da carga abaixo do gancho, ou `null` sem carga ou com medidas inválidas (fica só o gancho).
 * `attachOffsetM` é a distância de G até o ponto de amarração das lingas, na base do gancho; um valor
 * inválido (não finito ou ≤ 0) cai em `HOOK_ATTACH_OFFSET_M`.
 */
export function computeLoadBox(
  load: LoadDimensions | null | undefined,
  attachOffsetM: number = HOOK_ATTACH_OFFSET_M,
): LoadBoxLayout | null {
  if (!isValidLoad(load)) return null
  const attach =
    Number.isFinite(attachOffsetM) && attachOffsetM > 0 ? attachOffsetM : HOOK_ATTACH_OFFSET_M
  const topY = -(attach + slingDropM(load))
  const halfX = load.widthM / 2
  const halfZ = load.lengthM / 2
  return {
    size: { x: load.widthM, y: load.heightM, z: load.lengthM },
    center: { x: 0, y: topY - load.heightM / 2, z: 0 },
    slingTop: { x: 0, y: -attach, z: 0 },
    slingBottoms: [
      { x: -halfX, y: topY, z: -halfZ },
      { x: halfX, y: topY, z: -halfZ },
      { x: halfX, y: topY, z: halfZ },
      { x: -halfX, y: topY, z: halfZ },
    ],
  }
}

/** Mesmas medidas? Evita refazer a caixa quando a UI manda um objeto novo com os mesmos valores. */
export function sameLoad(
  a: LoadDimensions | null | undefined,
  b: LoadDimensions | null | undefined,
): boolean {
  const validA = isValidLoad(a)
  const validB = isValidLoad(b)
  if (!validA || !validB) return validA === validB
  return a.lengthM === b.lengthM && a.widthM === b.widthM && a.heightM === b.heightM
}
