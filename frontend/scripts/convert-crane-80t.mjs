// Conversão do modelo 3D "80-Ton Hydraulic Crane | Oilfield Completions" (awilliams1337, CC BY 4.0)
// para o GLB do simulador (TASK-064; ADR-031).
//
// Rodar, em frontend/:
//
//   node scripts/convert-crane-80t.mjs [entrada.glb] [saida.glb]
//
// Padrões: entrada `../assets/source/sketchfab/guindaste-80t/source/wireline_crane_rig.glb` (fora do
// Git, ver .gitignore) e saída `public/models/guindaste-80t.glb`. A conversão é determinística: a mesma
// entrada gera o mesmo arquivo, byte a byte (o script imprime o SHA-256 da saída).
//
// O que o script faz:
//
//  1. confere o SHA-256 da entrada (as regras abaixo dependem dos nomes e das medidas do arquivo);
//  2. descarta as peças de campo de petróleo (lubrificador, BOP, Frac Stack, linhas, polias de wireline,
//     piso), o cabo fixo do arquivo, a bola e o gancho auxiliares e a animação;
//  3. reescreve o modelo no referencial do simulador (ADR-013 C-1: metro, Y para cima, +Z para a
//     frente), com uma escala única, e o reorganiza nos nós que o frontend espera:
//
//       crane-base                      chassi, com as vigas fixas das patolas
//       ├── crane-turret                superestrutura, guinchos (extras.olhoDoOperador: câmera)
//       │   ├── crane-luffing-cylinder  camisa do cilindro de levantamento (filho da torre)
//       │   └── crane-boom              origem no pino P = (0, h, a); seção 1 da lança
//       │       ├── crane-luffing-rod   haste do cilindro (filha da lança)
//       │       └── crane-boom-extension  desliza no +Z; seções 2 a 4 e a cabeça
//       │           ├── crane-boom-section-02, -03 e -04   (as seções 2 e 3 são reposicionadas
//       │           │                   em `updateTelescope`, no loader, para a lança telescopar)
//       │           └── crane-boom-tip  ponta T (a L_min do pino em repouso)
//       │               └── crane-cable   pivô do cabo
//       │                   ├── crane-cable-line   linha de altura 1, topo na origem
//       │                   └── crane-hook         moitão (Hook_Block) e gancho giratório
//       ├── crane-outrigger-{fl,fr,rl,rr}-beam   viga que estende (com a camisa do macaco)
//       ├── crane-outrigger-{fl,fr,rl,rr}-jack   haste do macaco, que desce
//       └── crane-outrigger-{fl,fr,rl,rr}-pad    sapata
//
//     As malhas ficam em nós-folha sob cada nó de papel: a quantização do glTF coloca escala e
//     translação no nó da malha, e os nós de papel precisam ficar sem escala (aviso de calibração).
//  4. põe o modelo na pose de repouso do ADR-013 C-4 (regra 4): lança horizontal, toda recolhida,
//     gancho na ponta, patolas recolhidas e macacos suspensos;
//  5. reduz as texturas para 1024, deduplica, limpa e quantiza (KHR_mesh_quantization, que o
//     GLTFLoader lê sem decodificador). Sem Draco nem meshopt.
//
// Calibração (ficha FICTÍCIA de demo; frontend/src/three/crane/provisionalCraneSpec.ts): a escala sai
// da altura do pino da lança (h = 3,3 m). O eixo de giro (origem O) é o centro do anel de giro do
// arquivo, e o pino fica a = 0,46 m à frente dele; a ficha de demo usa esse a (TASK-069). O chassi é
// girado 180° para a lança em repouso ficar sobre a cabine. A lança recolhida mede L_min = 12 m: as
// seções 2 a 4 saem ~0,6 m da seção 1 em repouso. As medidas de cálculo nunca são lidas do GLB (RN-003).

import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { dedup, join, prune, quantize, textureCompress } from '@gltf-transform/functions'
import sharp from 'sharp'
import { Matrix3, Matrix4, Vector3 } from 'three'

const FRONTEND_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DEFAULT_INPUT = resolve(
  FRONTEND_DIR,
  '../assets/source/sketchfab/guindaste-80t/source/wireline_crane_rig.glb',
)
const DEFAULT_OUTPUT = resolve(FRONTEND_DIR, 'public/models/guindaste-80t.glb')

/** SHA-256 do GLB original (Sketchfab, 17 MB) para o qual as regras abaixo foram calibradas. */
const EXPECTED_INPUT_SHA256 = '808ffaa5e09937df54ca07b290edf0fa772252f4840d540f89e355fa1ea7ff66'

// ---------------------------------------------------------------------------------------------
// Medidas-alvo: ficha FICTÍCIA de demonstração (ADR-012; backend/app/demo_seed.py).
// ---------------------------------------------------------------------------------------------
const TARGET_PIVOT_HEIGHT_M = 3.3 // h: define a escala única
// a: o pino da lança fica 0,46 m à frente do eixo de giro real (centro do anel de giro da
// superestrutura, x = −1,30 no arquivo; pino em x = −1,70; escala ≈ 1,138). Antes, o eixo era
// deslocado para caber na ficha antiga (a = −1,56 m) e a superestrutura girava num arco (TASK-069).
const TARGET_PIVOT_OFFSET_M = 0.46
const TARGET_RETRACTED_LENGTH_M = 12 // L_min
/** Curso da lança telescópica na ficha de demo (22 − 12 m): só informativo (extras). */
const TARGET_TELESCOPE_TRAVEL_M = 10

// Medidas do arquivo original (unidades do arquivo = metros do modelo, antes da escala).
const SOURCE_SECTION_LENGTH = 10 // distância da seção 4 à polia da ponta (Boom_Nose.x)
const OUTRIGGER_RETRACT_SRC = 1.5 // quanto as vigas recolhem em relação ao arquivo (estendidas)
const OUTRIGGER_LIFT_SRC = 0.45 // quanto os macacos ficam suspensos em repouso
const PISTON_TOP_SRC = 0.9 // topo da haste do macaco, com a sapata no chão (fica dentro da camisa)
const CABLE_RADIUS_M = 0.035

// ---------------------------------------------------------------------------------------------
// Matrizes de mudança de eixos (arquivo → simulador). O arquivo aponta a lança para −X.
// ---------------------------------------------------------------------------------------------
/** Mundo do arquivo → simulador: X' = z, Y' = y, Z' = −x (frente = −X do arquivo). */
const R_WORLD = new Matrix4().set(0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 0, 1)
/**
 * Chassi girado 180° em torno do eixo de giro (TASK-069): no arquivo, a lança em repouso aponta para
 * a traseira do caminhão; no simulador, ψ = 0 é a frente, com a lança sobre a cabine.
 */
const R_CARRIER = new Matrix4().copy(R_WORLD).multiply(new Matrix4().makeRotationY(Math.PI))
/** Eixos locais da lança (x ao longo da lança, y para baixo) → simulador: X' = z, Y' = −y, Z' = x. */
const R_BOOM = new Matrix4().set(0, 0, 1, 0, 0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1)
/** Camisa do cilindro (eixo +x do arquivo) → +Y local do nó. */
const R_CYLINDER = new Matrix4().set(0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1)
/** Haste do cilindro: origem na ponta do pino, corpo ao longo de +Y local (em direção à camisa). */
const R_ROD = new Matrix4().set(0, 0, -1, 0, -1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1)

// ---------------------------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------------------------
const inputPath = resolve(process.argv[2] ?? DEFAULT_INPUT)
const outputPath = resolve(process.argv[3] ?? DEFAULT_OUTPUT)

const inputBytes = readFileSync(inputPath)
const inputSha = createHash('sha256').update(inputBytes).digest('hex')
if (inputSha !== EXPECTED_INPUT_SHA256) {
  console.error(
    `SHA-256 da entrada diferente do esperado.\n  esperado: ${EXPECTED_INPUT_SHA256}\n  recebido: ${inputSha}\n` +
      'As regras deste script foram calibradas para outro arquivo; revise-as antes de trocar a entrada.',
  )
  process.exit(1)
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
const doc = await io.readBinary(new Uint8Array(inputBytes))
const root = doc.getRoot()
const buffer = root.listBuffers()[0]
const scene = root.listScenes()[0]

const oldNodes = root.listNodes()
const byName = new Map(root.listNodes().map((node) => [node.getName(), node]))
const worldOf = new Map(
  root.listNodes().map((node) => [node, new Matrix4().fromArray(node.getWorldMatrix())]),
)
const need = (name) => {
  const node = byName.get(name)
  if (!node) throw new Error(`Nó "${name}" não existe no arquivo de entrada.`)
  return node
}
const world = (name) => worldOf.get(need(name)).clone()
const positionOf = (matrix) => new Vector3().setFromMatrixPosition(matrix)

/** Nós com malha no ramo de `name` (inclusive ele). */
function meshNodesUnder(name) {
  const found = []
  const visit = (node) => {
    if (node.getMesh()) found.push(node)
    node.listChildren().forEach(visit)
  }
  visit(need(name))
  return found
}

// ---------------------------------------------------------------------------------------------
// Escala e origem
// ---------------------------------------------------------------------------------------------
const pinSrc = positionOf(world('Boom_Elevation'))
const SCALE = TARGET_PIVOT_HEIGHT_M / pinSrc.y
// O fica (a / escala) à frente do pino, no eixo X do arquivo (a < 0: pino atrás de O).
const originSrc = new Vector3(pinSrc.x + TARGET_PIVOT_OFFSET_M / SCALE, 0, 0)
const S = new Matrix4().makeScale(SCALE, SCALE, SCALE)
const toSimulator = (frameSrc, rotation) =>
  new Matrix4().copy(S).multiply(rotation).multiply(new Matrix4().copy(frameSrc).invert())
const BASE_FRAME = new Matrix4().makeTranslation(originSrc.x, originSrc.y, originSrc.z)
/** Posição de um ponto do arquivo no referencial da base. */
const toBase = (point) => point.clone().applyMatrix4(toSimulator(BASE_FRAME, R_WORLD))

// ---------------------------------------------------------------------------------------------
// Geometria: copia as malhas de um nó do arquivo, já no referencial do nó de destino
// ---------------------------------------------------------------------------------------------
function accessorFrom(array, type) {
  return doc.createAccessor().setType(type).setArray(array).setBuffer(buffer)
}

/**
 * Copia as primitivas de `sourceNode` para `targetMesh`, aplicando: mundo do arquivo → `tweak`
 * (opcional, ainda em coordenadas do arquivo) → referencial `frameSrc` com os eixos de `rotation`.
 */
function bake(targetMesh, sourceNode, frameSrc, rotation, tweak) {
  const placement = worldOf.get(sourceNode)
  const full = toSimulator(frameSrc, rotation)
  const normalMatrix = new Matrix3().setFromMatrix4(
    new Matrix4()
      .copy(rotation)
      .multiply(new Matrix4().copy(frameSrc).invert())
      .multiply(placement),
  )
  const point = new Vector3()
  for (const source of sourceNode.getMesh().listPrimitives()) {
    const primitive = doc
      .createPrimitive()
      .setMode(source.getMode())
      .setMaterial(source.getMaterial())
    if (source.getIndices()) primitive.setIndices(source.getIndices())
    for (const semantic of source.listSemantics()) {
      const accessor = source.getAttribute(semantic)
      if (semantic === 'POSITION') {
        const out = new Float32Array(accessor.getCount() * 3)
        for (let i = 0; i < accessor.getCount(); i++) {
          point.fromArray(accessor.getElement(i, [0, 0, 0])).applyMatrix4(placement)
          if (tweak) tweak(point)
          point.applyMatrix4(full).toArray(out, i * 3)
        }
        primitive.setAttribute(semantic, accessorFrom(out, 'VEC3'))
      } else if (semantic === 'NORMAL') {
        const out = new Float32Array(accessor.getCount() * 3)
        for (let i = 0; i < accessor.getCount(); i++) {
          point
            .fromArray(accessor.getElement(i, [0, 0, 0]))
            .applyMatrix3(normalMatrix)
            .normalize()
            .toArray(out, i * 3)
        }
        primitive.setAttribute(semantic, accessorFrom(out, 'VEC3'))
      } else if (semantic === 'TANGENT') {
        const out = new Float32Array(accessor.getCount() * 4)
        const element = [0, 0, 0, 1]
        for (let i = 0; i < accessor.getCount(); i++) {
          accessor.getElement(i, element)
          point.set(element[0], element[1], element[2]).applyMatrix3(normalMatrix).normalize()
          out.set([point.x, point.y, point.z, element[3]], i * 4)
        }
        primitive.setAttribute(semantic, accessorFrom(out, 'VEC4'))
      } else {
        primitive.setAttribute(semantic, accessor)
      }
    }
    targetMesh.addPrimitive(primitive)
  }
}

// ---------------------------------------------------------------------------------------------
// Nós novos
// ---------------------------------------------------------------------------------------------
const newNode = (name, parent, translation = [0, 0, 0]) => {
  const node = doc.createNode(name).setTranslation(translation)
  parent?.addChild(node)
  return node
}

/** Nó-folha com uma malha só (as malhas nunca ficam nos nós de papel; ver o cabeçalho). */
function newMeshLeaf(name, parent, fill) {
  const mesh = doc.createMesh(name)
  fill(mesh)
  const leaf = doc.createNode(name).setMesh(mesh)
  parent.addChild(leaf)
  return leaf
}

scene.listChildren().forEach((node) => scene.removeChild(node))

const base = newNode('crane-base', scene)
const turret = newNode('crane-turret', base)
const boomPivot = [0, TARGET_PIVOT_HEIGHT_M, TARGET_PIVOT_OFFSET_M]
const boom = newNode('crane-boom', turret, boomPivot)
const extension = newNode('crane-boom-extension', boom)

// Chassi e as vigas fixas das patolas.
newMeshLeaf('chassi', base, (mesh) => {
  bake(mesh, need('Crane_Carrier__PBR'), BASE_FRAME, R_CARRIER)
  for (const n of [1, 2, 3, 4]) bake(mesh, need(`Outrigger_0${n}__PBR`), BASE_FRAME, R_CARRIER)
})

// Superestrutura e guinchos.
newMeshLeaf('superestrutura', turret, (mesh) => {
  for (const name of ['Crane_Upper__PBR', 'Main_Hoist_Winch__PBR', 'Aux_Hoist_Winch__PBR']) {
    bake(mesh, need(name), BASE_FRAME, R_WORLD)
  }
})

// Olho do operador (câmera "operador"): logo acima do teto da cabine, na frente da superestrutura.
// Vai nos `extras` da torre (`olhoDoOperador`, no referencial da torre): nó vazio some na otimização.
turret.setExtras({
  olhoDoOperador: toBase(new Vector3(-3.0, 4.5, 1.65))
    .toArray()
    .map((v) => Number(v.toFixed(3))),
})

// Lança: seção 1 na lança; seções 2 a 4 e a cabeça na extensão (pose recolhida).
const boomFrame = world('Boom_Elevation')
newMeshLeaf('lanca-secao-01', boom, (mesh) =>
  bake(mesh, need('Boom_Section_01__PBR'), boomFrame, R_BOOM),
)
const retractedStep = TARGET_RETRACTED_LENGTH_M - SOURCE_SECTION_LENGTH * SCALE // δ0
for (const k of [2, 3, 4]) {
  const section = newNode(`crane-boom-section-0${k}`, extension, [
    0,
    0,
    ((k - 1) / 3) * retractedStep,
  ])
  newMeshLeaf(`lanca-secao-0${k}`, section, (mesh) =>
    bake(mesh, need(`Boom_Section_0${k}__PBR`), world(`Boom_Section_0${k}`), R_BOOM),
  )
}
const tip = newNode('crane-boom-tip', extension, [0, 0, TARGET_RETRACTED_LENGTH_M])
// A ponta T fica no eixo da lança; a polia real fica ~1 m abaixo dele (a cabeça é desenhada como veio).
const tipFrame = world('Boom_Section_04').multiply(
  new Matrix4().makeTranslation(SOURCE_SECTION_LENGTH, 0, 0),
)
// A cabeça vem escura no arquivo (as UVs dela caem numa área escura do atlas de texturas): recebe um
// material liso na cor clara das seções da lança (TASK-069).
const boomMaterial = doc
  .createMaterial('lanca-cabeca')
  .setBaseColorFactor([0.86, 0.86, 0.84, 1])
  .setMetallicFactor(0.2)
  .setRoughnessFactor(0.6)
newMeshLeaf('lanca-cabeca', tip, (mesh) => {
  for (const node of meshNodesUnder('Boom_Nose')) {
    const before = mesh.listPrimitives().length
    bake(mesh, node, tipFrame, R_BOOM)
    if (node.getName() === 'Boom_Nose__PBR') {
      mesh
        .listPrimitives()
        .slice(before)
        .forEach((primitive) => primitive.setMaterial(boomMaterial))
    }
  }
})

// Cabo e moitão.
const cable = newNode('crane-cable', tip)
const cableLine = newNode('crane-cable-line', cable)
{
  const steel = doc
    .createMaterial('cabo')
    .setBaseColorFactor([0.07, 0.07, 0.08, 1])
    .setMetallicFactor(0.8)
    .setRoughnessFactor(0.5)
  const sides = 8
  const positions = new Float32Array((sides + 1) * 2 * 3)
  const normals = new Float32Array((sides + 1) * 2 * 3)
  const indices = []
  for (let i = 0; i <= sides; i++) {
    const angle = (i / sides) * Math.PI * 2
    const [cx, cz] = [Math.cos(angle), Math.sin(angle)]
    for (const [row, y] of [
      [0, 0],
      [1, -1],
    ]) {
      const at = (i * 2 + row) * 3
      positions.set([cx * CABLE_RADIUS_M, y, cz * CABLE_RADIUS_M], at)
      normals.set([cx, 0, cz], at)
    }
    if (i < sides) indices.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2)
  }
  newMeshLeaf('cabo', cableLine, (mesh) => {
    mesh.addPrimitive(
      doc
        .createPrimitive()
        .setMaterial(steel)
        .setAttribute('POSITION', accessorFrom(positions, 'VEC3'))
        .setAttribute('NORMAL', accessorFrom(normals, 'VEC3'))
        .setIndices(accessorFrom(new Uint16Array(indices), 'SCALAR')),
    )
  })
}
const hook = newNode('crane-hook', cable)
const hookFrame = world('Hook_Block')
newMeshLeaf('moitao', hook, (mesh) => {
  for (const node of meshNodesUnder('Hook_Block')) bake(mesh, node, hookFrame, R_WORLD)
})

// Cilindro de levantamento: camisa na torre, haste na lança, cada uma apontada para a outra
// (a pose da lança em repouso; o loader reaponta a cada comando).
const cylinderSrc = world('Boom_Luffing_Cylinder')
const rodSrc = world('Boom_Luffing_Rod')
const ROD_LENGTH = 3.44 // comprimento da haste no arquivo (x de 0 a 3,44)
const rodFrame = rodSrc.clone().multiply(new Matrix4().makeTranslation(ROD_LENGTH, 0, 0))
const basePin = toBase(positionOf(cylinderSrc)).toArray()
const rodPinBoom = positionOf(rodFrame)
  .applyMatrix4(new Matrix4().copy(boomFrame).invert())
  .applyMatrix4(new Matrix4().copy(S).multiply(R_BOOM))
const cylinder = newNode('crane-luffing-cylinder', turret, basePin)
const rod = newNode('crane-luffing-rod', boom, rodPinBoom.toArray())
newMeshLeaf('cilindro-camisa', cylinder, (mesh) =>
  bake(mesh, need('Boom_Luffing_Cylinder__PBR'), cylinderSrc, R_CYLINDER),
)
newMeshLeaf('cilindro-haste', rod, (mesh) =>
  bake(mesh, need('Boom_Luffing_Rod__PBR'), rodFrame, R_ROD),
)
{
  const upperPin = new Vector3(...boomPivot).add(rodPinBoom)
  const direction = upperPin.clone().sub(new Vector3(...basePin))
  const aim = (node, dy, dz) => {
    const angle = Math.atan2(dz, dy) / 2
    node.setRotation([Math.sin(angle), 0, 0, Math.cos(angle)])
  }
  aim(cylinder, direction.y, direction.z)
  aim(rod, -direction.y, -direction.z)
  console.log(
    `cilindro: pino de baixo ${basePin.map((v) => v.toFixed(3))}, pino de cima em repouso ${upperPin.toArray().map((v) => v.toFixed(3))}`,
  )
}

// Patolas: o arquivo as tem estendidas e com os macacos no chão; aqui ficam recolhidas e suspensas.
// Com o chassi girado 180°, cada patola do arquivo troca de canto (frente↔trás, esquerda↔direita).
const OUTRIGGERS = { 1: 'rr', 2: 'rl', 3: 'fr', 4: 'fl' }
const retract = OUTRIGGER_RETRACT_SRC * SCALE
const lift = OUTRIGGER_LIFT_SRC * SCALE
for (const [index, position] of Object.entries(OUTRIGGERS)) {
  const side = position.endsWith('l') ? 1 : -1
  const prefix = `crane-outrigger-${position}`
  const n = `0${index}`
  const beam = newNode(`${prefix}-beam`, base, [-side * retract, 0, 0])
  const jack = newNode(`${prefix}-jack`, base, [-side * retract, lift, 0])
  const pad = newNode(`${prefix}-pad`, base, [-side * retract, lift, 0])
  newMeshLeaf(`${prefix}-viga`, beam, (mesh) => {
    bake(mesh, need(`Outrigger_${n}_Extension__PBR`), BASE_FRAME, R_CARRIER)
    bake(mesh, need(`Outrigger_${n}_Jack__PBR`), BASE_FRAME, R_CARRIER)
  })
  // A haste é esticada para cima (base fixa na sapata), para continuar dentro da camisa quando sobe.
  const pistonBottom = positionOf(world(`Outrigger_${n}_Piston`)).y - 0.3
  const stretch = (PISTON_TOP_SRC - pistonBottom) / 0.33
  newMeshLeaf(`${prefix}-haste`, jack, (mesh) =>
    bake(mesh, need(`Outrigger_${n}_Piston__PBR`), BASE_FRAME, R_CARRIER, (point) => {
      point.y = pistonBottom + (point.y - pistonBottom) * stretch
    }),
  )
  newMeshLeaf(`${prefix}-sapata`, pad, (mesh) =>
    bake(mesh, need(`Outrigger_${n}_GroundPad__PBR`), BASE_FRAME, R_CARRIER),
  )
}

// ---------------------------------------------------------------------------------------------
// Limpeza do arquivo antigo, metadados e otimização
// ---------------------------------------------------------------------------------------------
for (const animation of root.listAnimations()) animation.dispose()
for (const node of oldNodes) node.dispose()

root.getAsset().generator = 'convert-crane-80t.mjs (glTF-Transform)'
root.getAsset().copyright =
  '80-Ton Hydraulic Crane | Oilfield Completions, de awilliams1337, CC BY 4.0 (modificado)'
base.setExtras({
  fonte: {
    titulo: '80-Ton Hydraulic Crane | Oilfield Completions',
    autor: 'awilliams1337',
    link: 'https://sketchfab.com/3d-models/80-ton-hydraulic-crane-oilfield-completions-27cbfdf2ef094d6283aa634ad6fb45c6',
    licenca: 'CC BY 4.0',
    modificado:
      'peças de campo de petróleo removidas, nós renomeados, texturas reduzidas, referencial e escala ajustados',
  },
  aviso: 'MODELO ILUSTRATIVO: não representa um guindaste real da empresa (RN-003).',
  medidasDoModelo: {
    boomPivotOffsetM: TARGET_PIVOT_OFFSET_M,
    boomPivotHeightM: TARGET_PIVOT_HEIGHT_M,
    boomRetractedLengthM: TARGET_RETRACTED_LENGTH_M,
    boomTravelM: TARGET_TELESCOPE_TRAVEL_M,
    outriggerTravelM: Number(retract.toFixed(4)),
    escala: Number(SCALE.toFixed(6)),
  },
})

await doc.transform(
  prune({ keepLeaves: true }),
  dedup(),
  join({ keepNamed: true }),
  textureCompress({ encoder: sharp, resize: [1024, 1024] }),
  quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12 }),
  prune({ keepLeaves: true }),
)

const output = await io.writeBinary(doc)
mkdirSync(dirname(outputPath), { recursive: true })
writeFileSync(outputPath, output)
console.log(`Entrada:  ${inputPath}\n  SHA-256 ${inputSha}`)
console.log(`Saída:    ${outputPath} (${(output.byteLength / 1048576).toFixed(2)} MB)`)
console.log(`  SHA-256 ${createHash('sha256').update(output).digest('hex')}`)
console.log(
  `  escala ${SCALE.toFixed(5)}; curso das vigas ${retract.toFixed(3)} m; folga dos macacos ${lift.toFixed(3)} m`,
)
