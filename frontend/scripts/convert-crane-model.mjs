// Conversão do modelo 3D do guindaste sobre caminhão: FBX do CGTrader → GLB do simulador (TASK-043).
//
// Rodar, em frontend/ (só com o `three` já instalado, sem dependência nova):
//
//   node scripts/convert-crane-model.mjs [entrada.fbx] [saida.glb]
//
// Padrões: entrada `../assets/source/cgtrader_optimized_prop_crane.fbx` (fora do Git, ver
// .gitignore) e saída `public/models/guindaste-caminhao.glb`. A conversão é determinística: a mesma
// entrada gera o mesmo arquivo, byte a byte (o script imprime o SHA-256 da saída).
//
// O que o script faz, na ordem:
//
//  1. lê o FBX com o FBXLoader e separa cada malha (uma por material) em componentes conexos (peças
//     soltas: triângulos ligados por vértices na mesma posição);
//  2. localiza, por regras explícitas (seção "Regras de classificação" abaixo), o eixo da lança, o
//     cubo do pino do pé da lança (P), o anel de giro, os pinos do cilindro de levantamento, o cabo
//     e o gancho, e classifica cada peça num papel: chassi, torre, lança (seção base, 2ª e 3ª seções
//     e cabeça da ponta), cilindro de levantamento, cabo e gancho;
//  3. escala para metros (escala única, pela altura do pino h da ficha FICTÍCIA de demo), com Y para
//     cima e +Z para a frente (lado da cabine do caminhão), ADR-013 C-1;
//  4. desfaz a inclinação da lança (cerca de 38° no FBX): as peças da lança passam a ser escritas no
//     referencial do nó da lança, com origem em P e lança ao longo de +Z (pose de repouso, ADR-013
//     C-4, regra 4);
//  5. recolhe as seções telescópicas e estica os tubos da lança ao longo do eixo até a lança
//     recolhida medir L_min (ver "Proporção" abaixo);
//  6. junta as peças por papel e por material, põe cada grupo sob o nó do seu papel, na hierarquia
//     que o mapeamento cinemático espera (assets/example-models/README.md), e exporta o GLB.
//
// Proporção (registrada em handoffs/TASK-043.md): a ficha FICTÍCIA de demo tinha a = −1,2 m,
// h = 3,3 m e lança recolhida L_min = 12 m. Com uma escala única, o modelo não chega às três: a
// escala que dá h = 3,3 m (caminhão de cerca de 9 m) deixa a lança toda recolhida com cerca de 6 m.
// Prioridade combinada: h e L_min. Por isso a escala sai de h e os tubos da lança são esticados ao
// longo do próprio eixo (só os tubos; colares, cabeça e polias não se deformam). O `a` resulta do
// modelo (−1,559 m); a pessoa responsável passou a ficha de demo para a = −1,56 m, para bater com ele
// (backend/app/demo_seed.py).
//
// Cabo: no FBX o cabo é uma malha fixa que vai do guincho da torre até a polia da ponta. Ela é
// descartada; no lugar, o nó `crane-cable-line` é uma linha de altura 1 com o topo na origem,
// escalada em Y pelo controller, como no guindaste provisório.
//
// Cilindro de levantamento: no FBX é rígido. Ele vira dois nós extras, fora dos papéis do
// mapeamento: `crane-luffing-cylinder` (camisa, filho da torre, origem no pino de baixo) e
// `crane-luffing-rod` (haste, filho da lança, origem no pino de cima). O eixo de cada peça é o +Y
// local; girando cada nó em X para apontar para o outro pino, o cilindro acompanha a lança
// (`updateLuffingCylinder` em src/three/loaders/loadTruckCraneModel.ts). No arquivo, eles já estão
// apontados para a pose de repouso.
//
// O modelo é ILUSTRATIVO: não representa um guindaste real específico. Nenhuma medida de cálculo é
// lida do GLB (RN-003; ADR-013 C-4, regra 1).

import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  BufferAttribute,
  BufferGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
} from 'three'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js'
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'

const FRONTEND_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DEFAULT_INPUT = resolve(FRONTEND_DIR, '../assets/source/cgtrader_optimized_prop_crane.fbx')
const DEFAULT_OUTPUT = resolve(FRONTEND_DIR, 'public/models/guindaste-caminhao.glb')

/** SHA-256 do FBX para o qual as regras abaixo foram calibradas. */
const EXPECTED_INPUT_SHA256 = '81f0b6b4da654a83aa0575216e6a42b39eca3b6e148bdc496f584371380321a1'

// ---------------------------------------------------------------------------------------------
// Medidas-alvo: ficha FICTÍCIA de demonstração (frontend/src/three/crane/provisionalCraneSpec.ts;
// backend/app/demo_seed.py). ADR-012: não são dados de nenhum guindaste real.
// ---------------------------------------------------------------------------------------------
/** h: altura do pino do pé da lança acima do chão (m). Define a escala única. */
const TARGET_PIVOT_HEIGHT_M = 3.3
/** L_min: lança toda recolhida, de P até T (m). Alcançado esticando os tubos da lança. */
const TARGET_RETRACTED_LENGTH_M = 12
/** a da ficha de demo (m; era −1,2 até a TASK-043). Só para o relatório: o `a` sai do modelo. */
const DEMO_PIVOT_OFFSET_M = -1.56
/** L_max da ficha de demo (m). Só para o relatório de sobreposição das seções. */
const DEMO_EXTENDED_LENGTH_M = 22
/** Onde começa a 2ª seção, recolhida, medido de P ao longo da lança (m): fica escondida na base. */
const SECOND_SECTION_REAR_FROM_PIVOT_M = 0.15
/** Raio da linha do cabo sintetizada (m). */
const CABLE_RADIUS_M = 0.035

/** Nomes dos nós (os mesmos do guindaste provisório, `CRANE_NODE_NAMES`). */
const NODE = {
  base: 'crane-base',
  turret: 'crane-turret',
  boom: 'crane-boom',
  boomExtension: 'crane-boom-extension',
  boomTip: 'crane-boom-tip',
  cable: 'crane-cable',
  cableLine: 'crane-cable-line',
  hook: 'crane-hook',
  luffingCylinder: 'crane-luffing-cylinder',
  luffingRod: 'crane-luffing-rod',
}

/** Material do FBX (pelo nome da malha; o FBX traz as cores vazias) → material PBR. */
const MATERIALS = {
  amarelo: { color: 0xf2b705, roughness: 0.55, metalness: 0.1 },
  preto: { color: 0x1c1f22, roughness: 0.85, metalness: 0.05 },
  branco: { color: 0xd4d8dc, roughness: 0.45, metalness: 0.25 },
  vidro: { color: 0x1b2a36, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.55 },
  cabo: { color: 0x2f3337, roughness: 0.5, metalness: 0.7 },
}
const MESH_MATERIAL = {
  C_craneYellowPlasticA_render_GEO: 'amarelo',
  C_craneBlackPlasticA_render_GEO: 'preto',
  C_craneWhitePlasticA_render_GEO: 'branco',
  C_craneGlassPlasticA_render_GEO: 'vidro',
}

// ---------------------------------------------------------------------------------------------
// Regras de classificação (no referencial local das malhas do FBX: X = largura, Y para cima,
// Z = comprimento com a cabine do caminhão em +Z; a rotação de −37° e a escala 0,457 da raiz
// `prop_craneModel_GRP` só posicionam o prop na cena de origem e são ignoradas). Unidades do FBX.
// Aplicadas nesta ordem; cada peça fica com o primeiro papel cuja regra ela satisfaz. A contagem
// esperada de peças por papel é conferida no fim (o script falha se mudar).
//
//  R1 cabo original   malha fina (largura em X < 0,03) e longa (> 2 em Z): o cabo do guincho à
//                     ponta. Descartado.
//  R2 tubos da lança  peças alongadas (comprimento no eixo principal ≥ 3× a maior seção), com o eixo
//                     principal no plano YZ e inclinado entre 20° e 60°: as 3 seções telescópicas.
//                     O eixo da lança (reta u) é o eixo principal dos três juntos. A seção de maior
//                     seção transversal é a base; depois a 2ª e a 3ª.
//  R3 pino do pé      peça cujo contorno em (s, n) — s ao longo da lança, n perpendicular a ela no
//                     plano vertical — é um círculo (|Δs − Δn| < 0,02) centrado no eixo (|n| < 0,05)
//                     a menos de 0,3 da traseira da seção base: o cubo do pino. Seu centro é P. Fica
//                     na torre (é simétrico em torno do eixo de articulação).
//  R4 anel de giro    peça preta com contorno quadrado em XZ (lado > 0,4, |Δx − Δz| < 0,01) entre
//                     y = 0,45 e 0,62: o rolamento de giro. O centro em XZ é o eixo de giro. Fica na
//                     torre.
//  R5 gancho          peças inteiras dentro da caixa x ∈ [−0,12; 0,06], y ∈ [1,6; 2,45],
//                     z ∈ [1,15; 1,5]: moitão e gancho.
//  R6 cilindro        peças na coluna x_centro ∈ [−0,08; 0,02], z ∈ [−0,42; −0,29],
//                     y ∈ [0,62; 1,55]. As de contorno circular em YZ (|Δy − Δz| < 0,01) são os pinos:
//                     o de baixo fica na torre, o de cima na lança. Das outras, a de baixo é a camisa
//                     e a de cima é a haste.
//  R7 lança           peças junto do eixo da lança (|n| ≤ 0,25), estreitas (largura em X ≤ 0,3,
//                     centro a menos de 0,1 do eixo em X) e que começam depois da traseira do pino
//                     (s ≥ s_P − 0,15). Subdivididas:
//                       - seção base: terminam até a frente da seção base (inclui suportes e o
//                         olhal do cilindro);
//                       - 2ª seção: o tubo da 2ª seção e o colar colado na sua frente;
//                       - 3ª seção: o tubo da 3ª seção e o colar colado na sua frente;
//                       - cabeça da ponta: o que começa depois da frente da 3ª seção (polias e eixos).
//  R8 torre           o que sobra acima do anel de giro (y_min ≥ base do anel) e atrás da metade do
//                     caminhão (z_max < 0): corpo, cabine do operador, guincho, suportes.
//  R9 chassi          todo o resto: caminhão, rodas, cabine de condução.
// ---------------------------------------------------------------------------------------------

const EXPECTED_COUNTS = {
  cabo: 1,
  gancho: 5,
  chassi: 113,
  torre: 24,
  cilindroCamisa: 1,
  cilindroHaste: 1,
  lancaBase: 4,
  lancaSegunda: 2,
  lancaTerceira: 2,
  lancaPonta: 5,
}

async function main() {
  const args = process.argv.slice(2).filter((arg) => !arg.startsWith('--'))
  const inputPath = resolve(args[0] ?? DEFAULT_INPUT)
  const outputPath = resolve(args[1] ?? DEFAULT_OUTPUT)

  const input = readFileSync(inputPath)
  const inputSha256 = createHash('sha256').update(input).digest('hex')
  if (inputSha256 !== EXPECTED_INPUT_SHA256) {
    throw new Error(
      `O FBX ${inputPath} (SHA-256 ${inputSha256}) não é o arquivo para o qual as regras de classificação foram calibradas (${EXPECTED_INPUT_SHA256}). Revise as regras antes de converter outro modelo.`,
    )
  }

  const fbx = new FBXLoader().parse(toArrayBuffer(input), '')
  const pieces = []
  fbx.traverse((object) => {
    if (object.isMesh) pieces.push(...splitConnectedComponents(object))
  })

  const frame = findReferenceFrame(pieces)
  classify(pieces, frame)
  const counts = countRoles(pieces)
  if (process.argv.includes('--listar')) listPieces(pieces)
  for (const [role, expected] of Object.entries(EXPECTED_COUNTS)) {
    if (counts[role] !== expected) {
      throw new Error(`Papel ${role}: ${counts[role] ?? 0} peças; esperado ${expected}.`)
    }
  }

  const layout = computeLayout(pieces, frame)
  const root = buildScene(pieces, frame, layout, inputSha256)
  const glb = await exportGlb(root)

  mkdirSync(dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, new Uint8Array(glb))
  report(pieces, counts, layout, root, glb, outputPath)
}

// ---------------------------------------------------------------------------------------------
// Peças (componentes conexos)
// ---------------------------------------------------------------------------------------------

/** Separa uma malha não indexada em peças soltas; vértices na mesma posição (1e-4) se ligam. */
function splitConnectedComponents(mesh) {
  const position = mesh.geometry.getAttribute('position')
  const normal = mesh.geometry.getAttribute('normal')
  const material = MESH_MATERIAL[mesh.name]
  if (material === undefined) throw new Error(`Malha inesperada no FBX: ${mesh.name}`)
  if (mesh.geometry.index !== null) throw new Error(`Malha ${mesh.name} indexada: não esperado.`)

  const count = position.count
  const ids = new Map()
  const vertexId = new Int32Array(count)
  for (let i = 0; i < count; i++) {
    const key = `${Math.round(position.getX(i) * 1e4)},${Math.round(position.getY(i) * 1e4)},${Math.round(position.getZ(i) * 1e4)}`
    let id = ids.get(key)
    if (id === undefined) {
      id = ids.size
      ids.set(key, id)
    }
    vertexId[i] = id
  }
  const parent = Int32Array.from({ length: ids.size }, (_, i) => i)
  const find = (x) => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]]
      x = parent[x]
    }
    return x
  }
  for (let t = 0; t < count; t += 3) {
    for (const k of [1, 2]) {
      const a = find(vertexId[t])
      const b = find(vertexId[t + k])
      if (a !== b) parent[a] = b
    }
  }

  const byRoot = new Map()
  for (let t = 0; t < count; t += 3) {
    const rootId = find(vertexId[t])
    let piece = byRoot.get(rootId)
    if (piece === undefined) {
      piece = { mesh: mesh.name, material, positions: [], normals: [], role: undefined }
      byRoot.set(rootId, piece)
    }
    for (let k = 0; k < 3; k++) {
      const i = t + k
      piece.positions.push([position.getX(i), position.getY(i), position.getZ(i)])
      piece.normals.push([normal.getX(i), normal.getY(i), normal.getZ(i)])
    }
  }
  const result = [...byRoot.values()]
  for (const piece of result) piece.box = boundingBox(piece.positions)
  return result
}

function boundingBox(points) {
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  for (const p of points) {
    for (let a = 0; a < 3; a++) {
      if (p[a] < min[a]) min[a] = p[a]
      if (p[a] > max[a]) max[a] = p[a]
    }
  }
  return {
    min,
    max,
    size: max.map((v, a) => v - min[a]),
    center: max.map((v, a) => (v + min[a]) / 2),
  }
}

/** Centróide e eixo principal (maior variância) de uma nuvem de pontos. */
function principalAxis(points) {
  const c = [0, 0, 0]
  for (const p of points) for (let a = 0; a < 3; a++) c[a] += p[a] / points.length
  const cov = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ]
  for (const p of points) {
    for (let a = 0; a < 3; a++) {
      for (let b = 0; b < 3; b++) cov[a][b] += (p[a] - c[a]) * (p[b] - c[b])
    }
  }
  let v = [0, 1, 1]
  for (let iteration = 0; iteration < 200; iteration++) {
    const w = [0, 1, 2].map((a) => cov[a][0] * v[0] + cov[a][1] * v[1] + cov[a][2] * v[2])
    const length = Math.hypot(...w)
    v = w.map((x) => x / length)
  }
  if (v[2] < 0) v = v.map((x) => -x)
  return { centroid: c, axis: v }
}

// ---------------------------------------------------------------------------------------------
// Referencial: eixo da lança, P, eixo de giro, chão
// ---------------------------------------------------------------------------------------------

function findReferenceFrame(pieces) {
  // R1: o cabo original sai antes de tudo (ele também é longo e inclinado).
  for (const piece of pieces) {
    if (piece.box.size[0] < 0.03 && piece.box.size[2] > 2) piece.role = 'cabo'
  }

  // R2: tubos da lança.
  const tubes = []
  for (const piece of pieces) {
    if (piece.role !== undefined) continue
    const { centroid, axis } = principalAxis(piece.positions)
    if (Math.abs(axis[0]) > 0.05) continue
    const angle = (Math.atan2(Math.abs(axis[1]), Math.abs(axis[2])) * 180) / Math.PI
    if (angle < 20 || angle > 60) continue
    const along = piece.positions.map((p) => dot3(sub3(p, centroid), axis))
    const length = Math.max(...along) - Math.min(...along)
    const across = Math.max(piece.box.size[0], perpendicularSpan(piece.positions, centroid, axis))
    if (length >= 3 * across) tubes.push({ piece, across })
  }
  if (tubes.length !== 3) throw new Error(`Tubos da lança: ${tubes.length}; esperado 3.`)
  tubes.sort((a, b) => b.across - a.across)
  const [baseTube, secondTube, thirdTube] = tubes.map((tube) => tube.piece)
  const boomAxis = principalAxis(tubes.flatMap((tube) => tube.piece.positions))
  const u = boomAxis.axis
  const up = [0, u[2], -u[1]] // perpendicular a u no plano YZ, apontando para cima
  const origin = boomAxis.centroid
  const sn = (p) => {
    const d = sub3(p, origin)
    return [dot3(d, u), dot3(d, up)]
  }
  for (const piece of pieces) {
    const coords = piece.positions.map(sn)
    piece.s = [Math.min(...coords.map((c) => c[0])), Math.max(...coords.map((c) => c[0]))]
    piece.n = [Math.min(...coords.map((c) => c[1])), Math.max(...coords.map((c) => c[1]))]
  }

  // R3: cubo do pino do pé da lança.
  const hubs = pieces.filter((piece) => {
    if (piece.role !== undefined) return false
    const ds = piece.s[1] - piece.s[0]
    const dn = piece.n[1] - piece.n[0]
    const sCenter = (piece.s[0] + piece.s[1]) / 2
    const nCenter = (piece.n[0] + piece.n[1]) / 2
    return (
      Math.abs(ds - dn) < 0.02 &&
      Math.abs(nCenter) < 0.05 &&
      Math.abs(sCenter - baseTube.s[0]) < 0.3 &&
      piece.box.size[0] > 0.25
    )
  })
  if (hubs.length !== 1) throw new Error(`Pino do pé da lança: ${hubs.length} peças; esperado 1.`)
  const hub = hubs[0]
  hub.role = 'torre'
  const pivotSN = [(hub.s[0] + hub.s[1]) / 2, (hub.n[0] + hub.n[1]) / 2]
  const axisX = origin[0]
  const pivot = [axisX, ...addScaledYZ(origin, u, up, pivotSN)]

  // R4: anel de giro.
  const rings = pieces.filter(
    (piece) =>
      piece.role === undefined &&
      piece.material === 'preto' &&
      piece.box.size[0] > 0.4 &&
      Math.abs(piece.box.size[0] - piece.box.size[2]) < 0.01 &&
      piece.box.min[1] >= 0.45 &&
      piece.box.max[1] <= 0.62,
  )
  if (rings.length !== 1) throw new Error(`Anel de giro: ${rings.length} peças; esperado 1.`)
  const ring = rings[0]
  ring.role = 'torre'

  const groundY = Math.min(...pieces.map((piece) => piece.box.min[1]))
  return {
    u,
    up,
    origin,
    sn,
    pivot,
    pivotS: pivotSN[0],
    axisX,
    slewZ: ring.box.center[2],
    slewX: ring.box.center[0],
    turretY: ring.box.min[1],
    groundY,
    baseTube,
    secondTube,
    thirdTube,
  }
}

function perpendicularSpan(points, centroid, axis) {
  let max = 0
  for (const p of points) {
    const d = sub3(p, centroid)
    const along = dot3(d, axis)
    const perp = [d[0] - along * axis[0], d[1] - along * axis[1], d[2] - along * axis[2]]
    max = Math.max(max, Math.hypot(...perp))
  }
  return 2 * max
}

/** Ponto (y, z) = origin + s·u + n·up. */
function addScaledYZ(origin, u, up, [s, n]) {
  return [origin[1] + s * u[1] + n * up[1], origin[2] + s * u[2] + n * up[2]]
}

// ---------------------------------------------------------------------------------------------
// Classificação (R5 a R9)
// ---------------------------------------------------------------------------------------------

function classify(pieces, frame) {
  const inside = (box, min, max) =>
    box.min.every((v, a) => v >= min[a]) && box.max.every((v, a) => v <= max[a])

  // R5: gancho.
  for (const piece of pieces) {
    if (piece.role !== undefined) continue
    if (inside(piece.box, [-0.12, 1.6, 1.15], [0.06, 2.45, 1.5])) piece.role = 'gancho'
  }

  // R6: cilindro de levantamento.
  const column = pieces.filter(
    (piece) =>
      piece.role === undefined &&
      piece.box.center[0] >= -0.08 &&
      piece.box.center[0] <= 0.02 &&
      inside(piece.box, [-Infinity, 0.62, -0.42], [Infinity, 1.55, -0.29]),
  )
  const pins = column
    .filter((piece) => Math.abs(piece.box.size[1] - piece.box.size[2]) < 0.01)
    .sort((a, b) => a.box.center[1] - b.box.center[1])
  const bodies = column
    .filter((piece) => !pins.includes(piece))
    .sort((a, b) => a.box.center[1] - b.box.center[1])
  if (pins.length !== 2 || bodies.length !== 2) {
    throw new Error(`Cilindro: ${pins.length} pinos e ${bodies.length} corpos; esperado 2 e 2.`)
  }
  const [lowerPin, upperPin] = pins
  lowerPin.role = 'torre'
  upperPin.role = 'lancaBase'
  bodies[0].role = 'cilindroCamisa'
  bodies[1].role = 'cilindroHaste'
  frame.cylinderBasePin = lowerPin.box.center
  frame.cylinderHeadPin = upperPin.box.center

  // R7: lança.
  const { baseTube, secondTube, thirdTube, pivotS } = frame
  const touches = (piece, tube) => Math.abs(piece.s[0] - tube.s[1]) < 0.02
  for (const piece of pieces) {
    if (piece.role !== undefined) continue
    const nearAxis =
      piece.n[0] >= -0.25 &&
      piece.n[1] <= 0.25 &&
      piece.box.size[0] <= 0.3 &&
      Math.abs(piece.box.center[0] - frame.axisX) < 0.1 &&
      piece.s[0] >= pivotS - 0.15
    if (!nearAxis) continue
    if (piece === secondTube || touches(piece, secondTube)) piece.role = 'lancaSegunda'
    else if (piece === thirdTube || touches(piece, thirdTube)) piece.role = 'lancaTerceira'
    else if (piece.s[0] > thirdTube.s[1] + 0.05) piece.role = 'lancaPonta'
    else if (piece.s[1] <= baseTube.s[1] + 0.01) piece.role = 'lancaBase'
    else throw new Error(`Peça junto da lança sem seção definida (s = ${piece.s}).`)
  }
  frame.boomBaseAttachmentsEndS = Math.max(
    ...pieces.filter((p) => p.role === 'lancaBase' && p !== baseTube).map((p) => p.s[1]),
  )

  // R8 e R9: torre e chassi.
  for (const piece of pieces) {
    if (piece.role !== undefined) continue
    piece.role =
      piece.box.min[1] >= frame.turretY - 1e-3 && piece.box.max[2] < 0 ? 'torre' : 'chassi'
  }
}

/** `--listar`: uma linha por peça, com papel, material, triângulos e caixa (unidades do FBX). */
function listPieces(pieces) {
  const f = (v) => v.map((x) => x.toFixed(3).padStart(7)).join(' ')
  for (const piece of [...pieces].sort((a, b) => a.box.min[2] - b.box.min[2])) {
    const triangles = String(piece.positions.length / 3).padStart(6)
    console.log(
      `${piece.role.padEnd(15)} ${piece.material.padEnd(8)} ${triangles}  min ${f(piece.box.min)}  max ${f(piece.box.max)}`,
    )
  }
}

function countRoles(pieces) {
  const counts = {}
  for (const piece of pieces) counts[piece.role] = (counts[piece.role] ?? 0) + 1
  return counts
}

// ---------------------------------------------------------------------------------------------
// Escala, recolhimento e esticamento da lança
// ---------------------------------------------------------------------------------------------

function computeLayout(pieces, frame) {
  const { baseTube, secondTube, thirdTube, pivotS } = frame
  const scale = TARGET_PIVOT_HEIGHT_M / (frame.pivot[1] - frame.groundY)
  const collarOf = (role, tube) =>
    pieces.find((piece) => piece.role === role && piece !== tube && piece.s[0] > tube.s[0])
  const secondCollar = collarOf('lancaSegunda', secondTube)
  const thirdCollar = collarOf('lancaTerceira', thirdTube)

  // Recolhimento (unidades do FBX, ao longo de s): o colar da 2ª seção encosta na frente da base e
  // o colar da 3ª encosta no da 2ª.
  const retractSecond = secondCollar.s[0] - baseTube.s[1]
  const retractThird = thirdCollar.s[0] - secondCollar.s[1]

  // T: projeção no eixo da lança do ponto onde o cabo original deixa a polia da ponta, que é o topo
  // do trecho vertical do cabo (vértices a menos de 0,02 do z máximo; o trecho desce até o moitão).
  // Com a lança horizontal, a vertical por T passa por esse ponto.
  const cable = pieces.find((piece) => piece.role === 'cabo')
  const cableMaxZ = Math.max(...cable.positions.map((p) => p[2]))
  const drop = boundingBox(cable.positions.filter((p) => p[2] >= cableMaxZ - 0.02))
  const cableDeparture = [drop.center[0], drop.max[1], drop.center[2]]
  const tipS = frame.sn(cableDeparture)[0]
  const tipRetractedT = tipS - pivotS - retractSecond - retractThird

  const retractedLengthUnits = TARGET_RETRACTED_LENGTH_M / scale
  const stretch = retractedLengthUnits - tipRetractedT

  // Mapas lineares por partes em t (distância a P ao longo da lança, já recolhida): nós (t_entrada,
  // t_saída); fora dos nós, translação. Só os tubos se deformam.
  const cap = 0.03
  const t = (s) => s - pivotS
  const baseMap = [
    [t(frame.boomBaseAttachmentsEndS + 0.05), t(frame.boomBaseAttachmentsEndS + 0.05)],
    [t(baseTube.s[1] - cap), t(baseTube.s[1] - cap) + stretch],
  ]
  const secondRearTarget = SECOND_SECTION_REAR_FROM_PIVOT_M / scale
  const secondRear = t(secondTube.s[0]) - retractSecond
  const secondMap = [
    [
      t(secondTube.s[0] + cap) - retractSecond,
      t(secondTube.s[0] + cap) - retractSecond + (secondRearTarget - secondRear),
    ],
    [t(secondTube.s[1] - cap) - retractSecond, t(secondTube.s[1] - cap) - retractSecond + stretch],
  ]
  const thirdShift = retractSecond + retractThird
  const thirdMap = [
    [t(thirdTube.s[0] + cap) - thirdShift, t(thirdTube.s[0] + cap) - thirdShift],
    [t(thirdTube.s[1] - cap) - thirdShift, t(thirdTube.s[1] - cap) - thirdShift + stretch],
  ]

  const pivotM = [
    0,
    (frame.pivot[1] - frame.groundY) * scale,
    (frame.pivot[2] - frame.slewZ) * scale,
  ]
  const turretY = (frame.turretY - frame.groundY) * scale
  const baseFrontM = (t(baseTube.s[1]) + stretch) * scale
  return {
    scale,
    retractSecond,
    retractThird,
    stretch,
    retractedLengthUnits,
    baseMap,
    secondMap,
    thirdMap,
    thirdShift,
    pivotM,
    turretY,
    tipS,
    secondRearM: SECOND_SECTION_REAR_FROM_PIVOT_M,
    baseFrontM,
    overlapAtDemoMaxM:
      baseFrontM -
      (SECOND_SECTION_REAR_FROM_PIVOT_M + (DEMO_EXTENDED_LENGTH_M - TARGET_RETRACTED_LENGTH_M)),
  }
}

/** Mapa linear por partes com dois nós; fora deles, translação pelo deslocamento do nó mais perto. */
function piecewise(map, value) {
  const [[a0, b0], [a1, b1]] = map
  if (value <= a0) return value + (b0 - a0)
  if (value >= a1) return value + (b1 - a1)
  return b0 + ((value - a0) * (b1 - b0)) / (a1 - a0)
}

// ---------------------------------------------------------------------------------------------
// Cena
// ---------------------------------------------------------------------------------------------

function buildScene(pieces, frame, layout, inputSha256) {
  const { scale } = layout
  const materials = Object.fromEntries(
    Object.entries(MATERIALS).map(([name, params]) => {
      const material = new MeshStandardMaterial(params)
      material.name = name
      return [name, material]
    }),
  )

  const pivotS = frame.pivotS
  const retractedLengthM = TARGET_RETRACTED_LENGTH_M
  const toBase = (p) => [
    (p[0] - frame.axisX) * scale,
    (p[1] - frame.groundY) * scale,
    (p[2] - frame.slewZ) * scale,
  ]
  const toTurret = (p) => {
    const b = toBase(p)
    return [b[0], b[1] - layout.turretY, b[2]]
  }
  /** Referencial da lança em repouso: origem em P, +Z ao longo da lança, +Y perpendicular acima. */
  const boomLocal = (p, mapT = (t) => t) => {
    const [s, n] = frame.sn(p)
    return [
      (p[0] - frame.axisX) * scale,
      (n - frame.sn(frame.pivot)[1]) * scale,
      mapT(s - pivotS) * scale,
    ]
  }
  const boomNormal = (v) => [v[0], dot3(v, frame.up), dot3(v, frame.u)]
  const identityNormal = (v) => v

  const hookPieces = pieces.filter((piece) => piece.role === 'gancho')
  const hookBox = boundingBox(hookPieces.flatMap((piece) => piece.positions))
  const hookTop = [hookBox.center[0], hookBox.max[1], hookBox.center[2]]

  const tubeMap = new Map([
    [frame.baseTube, (t) => piecewise(layout.baseMap, t)],
    [frame.secondTube, (t) => piecewise(layout.secondMap, t - layout.retractSecond)],
    [frame.thirdTube, (t) => piecewise(layout.thirdMap, t - layout.thirdShift)],
  ])
  const rigidMap = {
    lancaBase: (t) => t,
    lancaSegunda: (t) => t - layout.retractSecond + layout.stretch,
    lancaTerceira: (t) => t - layout.thirdShift + layout.stretch,
    lancaPonta: (t) => t - layout.thirdShift + layout.stretch,
  }

  const basePinTurret = toTurret(frame.cylinderBasePin)
  const headPinBoom = boomLocal(frame.cylinderHeadPin)
  const basePinBoomTilted = boomLocal(frame.cylinderBasePin)

  /** Transformação de cada peça para o nó onde ela entra: [nó, posição(p), normal(v)]. */
  const placement = (piece) => {
    switch (piece.role) {
      case 'chassi':
        return [NODE.base, toBase, identityNormal]
      case 'torre':
        return [NODE.turret, toTurret, identityNormal]
      case 'gancho':
        return [NODE.hook, (p) => sub3(p, hookTop).map((v) => v * scale), identityNormal]
      case 'cilindroCamisa': {
        const rotate = alignToY(sub3(frame.cylinderHeadPin, frame.cylinderBasePin))
        return [NODE.luffingCylinder, (p) => rotate(sub3(toTurret(p), basePinTurret)), rotate]
      }
      case 'cilindroHaste': {
        const rotate = alignToY(sub3(basePinBoomTilted, headPinBoom))
        return [
          NODE.luffingRod,
          (p) => rotate(sub3(boomLocal(p), headPinBoom)),
          (v) => rotate(boomNormal(v)),
        ]
      }
      case 'lancaBase':
      case 'lancaSegunda':
      case 'lancaTerceira':
      case 'lancaPonta': {
        const mapT = tubeMap.get(piece) ?? rigidMap[piece.role]
        const node =
          piece.role === 'lancaBase'
            ? NODE.boom
            : piece.role === 'lancaPonta'
              ? NODE.boomTip
              : NODE.boomExtension
        const offsetZ = piece.role === 'lancaPonta' ? retractedLengthM : 0
        return [
          node,
          (p) => {
            const local = boomLocal(p, mapT)
            return [local[0], local[1], local[2] - offsetZ]
          },
          boomNormal,
        ]
      }
      default:
        return undefined
    }
  }

  // Geometria por nó e material.
  const buckets = new Map()
  for (const piece of pieces) {
    const target = placement(piece)
    if (target === undefined) continue
    const [nodeName, position, normal] = target
    const key = `${nodeName}|${piece.material}`
    let bucket = buckets.get(key)
    if (bucket === undefined) {
      bucket = { nodeName, material: piece.material, positions: [], normals: [] }
      buckets.set(key, bucket)
    }
    for (let i = 0; i < piece.positions.length; i++) {
      bucket.positions.push(...position(piece.positions[i]))
      bucket.normals.push(...normalize3(normal(piece.normals[i])))
    }
  }

  // Nós.
  const nodes = Object.fromEntries(
    Object.values(NODE)
      .filter((name) => name !== NODE.cableLine)
      .map((name) => {
        const group = new Group()
        group.name = name
        return [name, group]
      }),
  )
  const base = nodes[NODE.base]
  const turret = nodes[NODE.turret]
  const boom = nodes[NODE.boom]
  turret.position.set(0, layout.turretY, 0)
  base.add(turret)
  boom.position.set(0, layout.pivotM[1] - layout.turretY, layout.pivotM[2])
  turret.add(boom)
  boom.add(nodes[NODE.boomExtension])
  nodes[NODE.boomTip].position.set(0, 0, retractedLengthM)
  nodes[NODE.boomExtension].add(nodes[NODE.boomTip])
  nodes[NODE.boomTip].add(nodes[NODE.cable])

  const cableGeometry = new CylinderGeometry(CABLE_RADIUS_M, CABLE_RADIUS_M, 1, 8)
  cableGeometry.translate(0, -0.5, 0) // altura 1, topo na origem: a escala em Y é o comprimento
  cableGeometry.deleteAttribute('uv')
  const cableLine = new Mesh(cableGeometry, materials.cabo)
  cableLine.name = NODE.cableLine
  nodes[NODE.cable].add(cableLine)
  nodes[NODE.cable].add(nodes[NODE.hook])

  const cylinder = nodes[NODE.luffingCylinder]
  cylinder.position.set(...basePinTurret)
  turret.add(cylinder)
  const rod = nodes[NODE.luffingRod]
  rod.position.set(...headPinBoom)
  boom.add(rod)
  // Pose de repouso: cada peça do cilindro aponta para o pino da outra (ver cabeçalho).
  const headPinTurret = add3(boom.position.toArray(), headPinBoom)
  cylinder.rotation.x = aimAngle(sub3(headPinTurret, basePinTurret))
  rod.rotation.x = aimAngle(sub3(sub3(basePinTurret, boom.position.toArray()), headPinBoom))

  const roleLabel = {
    [NODE.base]: 'chassi',
    [NODE.turret]: 'torre',
    [NODE.boom]: 'lanca-base',
    [NODE.boomExtension]: 'lanca-extensao',
    [NODE.boomTip]: 'lanca-ponta',
    [NODE.hook]: 'gancho',
    [NODE.luffingCylinder]: 'cilindro-camisa',
    [NODE.luffingRod]: 'cilindro-haste',
  }
  for (const bucket of [...buckets.values()].sort((a, b) =>
    `${a.nodeName}|${a.material}`.localeCompare(`${b.nodeName}|${b.material}`),
  )) {
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(bucket.positions), 3))
    geometry.setAttribute('normal', new BufferAttribute(new Float32Array(bucket.normals), 3))
    const indexed = mergeVertices(geometry, 1e-5)
    const mesh = new Mesh(indexed, materials[bucket.material])
    mesh.name = `${roleLabel[bucket.nodeName]}-${bucket.material}`
    nodes[bucket.nodeName].add(mesh)
  }

  const boomLengthOverlap = Number(layout.overlapAtDemoMaxM.toFixed(3))
  base.userData = {
    ficticio: true,
    ilustrativo: true,
    aviso:
      'MODELO ILUSTRATIVO: guindaste sobre caminhão genérico (prop do CGTrader), não representa nenhum guindaste real. Medidas ajustadas à ficha FICTÍCIA de demonstração; a geometria de cálculo vem da ficha técnica, nunca deste arquivo (RN-003). Gerado pela TASK-043.',
    origem: {
      arquivo: 'cgtrader_optimized_prop_crane.fbx',
      fonte: 'CGTrader, fornecido pela pessoa responsável',
      sha256: inputSha256,
      licenca:
        'permite versionar o GLB derivado e distribuí-lo embutido na aplicação (confirmado pela pessoa responsável em 2026-09-26; handoffs/TASK-043.md)',
    },
    conversao: {
      script: 'frontend/scripts/convert-crane-model.mjs',
      tarefa: 'TASK-043',
      escalaFbxParaMetro: Number(scale.toFixed(6)),
      esticamentoDaLancaM: Number((layout.stretch * scale).toFixed(3)),
      caboOriginal: 'descartado; crane-cable-line é sintetizado (altura 1, escalado em Y)',
      sobreposicaoDaSegundaSecaoEm22mM: boomLengthOverlap,
    },
    medidasDoModelo: {
      boomPivotOffsetM: Number(layout.pivotM[2].toFixed(4)),
      boomPivotHeightM: Number(layout.pivotM[1].toFixed(4)),
      boomRetractedLengthM: retractedLengthM,
    },
  }
  return base
}

/** Rotação em torno de X que leva a direção `from` (no plano YZ) para +Y. */
function alignToY(from) {
  const angle = -aimAngle(from)
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return (v) => [v[0], v[1] * c - v[2] * s, v[1] * s + v[2] * c]
}

/** Ângulo em X que leva +Y para a direção `d` (no plano YZ): rotação.x = atan2(d.z, d.y). */
function aimAngle(d) {
  return Math.atan2(d[2], d[1])
}

// ---------------------------------------------------------------------------------------------
// Exportação
// ---------------------------------------------------------------------------------------------

async function exportGlb(root) {
  installFileReaderShim()
  const result = await new GLTFExporter().parseAsync(root, { binary: true })
  if (!(result instanceof ArrayBuffer)) throw new Error('GLTFExporter não devolveu um GLB.')
  return result
}

/** O GLTFExporter usa `FileReader`, que o Node não tem: substituto mínimo, só com o que ele chama. */
function installFileReaderShim() {
  if (typeof globalThis.FileReader !== 'undefined') return
  globalThis.FileReader = class {
    result = null
    onloadend = null
    readAsArrayBuffer(blob) {
      void blob.arrayBuffer().then((buffer) => {
        this.result = buffer
        this.onloadend?.()
      })
    }
    readAsDataURL(blob) {
      void blob.arrayBuffer().then((buffer) => {
        this.result = `data:${blob.type};base64,${Buffer.from(buffer).toString('base64')}`
        this.onloadend?.()
      })
    }
  }
}

function report(pieces, counts, layout, root, glb, outputPath) {
  const triangles = {}
  for (const piece of pieces) {
    triangles[piece.role] = (triangles[piece.role] ?? 0) + piece.positions.length / 3
  }
  let exported = 0
  root.traverse((object) => {
    if (object.isMesh) exported += object.geometry.index.count / 3
  })
  const sha = createHash('sha256').update(new Uint8Array(glb)).digest('hex')
  const f = (v, d = 3) => v.toFixed(d)
  console.log(`GLB: ${outputPath}`)
  console.log(`  tamanho: ${glb.byteLength} bytes (${f(glb.byteLength / 1024 / 1024, 2)} MiB)`)
  console.log(`  SHA-256: ${sha}`)
  console.log(`  peças por papel: ${JSON.stringify(counts)}`)
  console.log(`  triângulos por papel: ${JSON.stringify(triangles)}`)
  console.log(`  triângulos no GLB (sem o cabo original, com o cabo sintetizado): ${exported}`)
  console.log(`  escala FBX → m: ${f(layout.scale, 6)}`)
  console.log(
    `  P = (0, ${f(layout.pivotM[1])}, ${f(layout.pivotM[2])}) m; ficha de demo: (0, ${TARGET_PIVOT_HEIGHT_M}, ${DEMO_PIVOT_OFFSET_M})`,
  )
  console.log(
    `  lança recolhida: ${TARGET_RETRACTED_LENGTH_M} m (sem esticar: ${f((layout.retractedLengthUnits - layout.stretch) * layout.scale)} m; esticamento ${f(layout.stretch * layout.scale)} m)`,
  )
  console.log(
    `  2ª seção: de ${layout.secondRearM} m a ${f(layout.baseFrontM)} m de P; sobreposição em ${DEMO_EXTENDED_LENGTH_M} m: ${f(layout.overlapAtDemoMaxM)} m`,
  )
}

// ---------------------------------------------------------------------------------------------
// Vetores
// ---------------------------------------------------------------------------------------------

function toArrayBuffer(buffer) {
  const copy = new ArrayBuffer(buffer.byteLength)
  new Uint8Array(copy).set(buffer)
  return copy
}
function sub3(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}
function add3(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
}
function dot3(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}
function normalize3(v) {
  const length = Math.hypot(...v)
  return length === 0 ? v : v.map((x) => x / length)
}

await main()
