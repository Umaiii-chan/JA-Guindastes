// Otimiza os modelos do Sketchfab (CC BY 4.0) do galpão e das cargas para a web (leva F).
//
// Rodar, em frontend/:
//
//   node scripts/build-sketchfab-models.mjs [pasta-sketchfab] [pasta-public-models]
//
// Padrões: entrada `../assets/source/sketchfab` (fora do Git, ver .gitignore; subpastas `galpoes/` e
// `cargas/`) e saída `public/models` (`objetos/` e `cargas/`). Créditos em
// `public/models/objetos/CREDITS.md` e `public/models/cargas/CREDITS.md`.
//
// O que o script faz com cada modelo:
//
//  1. tira o que não é usado (outras vigas do conjunto, o pano da frente do galpão e o toldo);
//  2. gira em torno de Y, se preciso, e aplica uma escala única até o tamanho real em metros, com a
//     base em y = 0 e o centro da planta em (0, 0), como os demais objetos da biblioteca;
//  3. texturas até 1024 px em WebP, vértices soldados e quantizados (KHR_mesh_quantization).
//
// Cargas: o comprimento fica em +Z, a largura em X e a altura em Y (o mesmo referencial da caixa da
// carga, `domain/collision/loadBox`). A cena escala o modelo para as medidas digitadas.
//
// O galpão é o hangar de nermin (cm): a frente (+Z) perde o pano com o portão fechado e o toldo, e fica
// aberta como um túnel; o fundo (-Z) continua fechado. As caixas de colisão estão em
// `src/domain/environment/objectLibrary.ts` e seguem as medidas impressas aqui (um teste confere).
//
// No fim o script imprime as medidas finais de cada arquivo (`baseSize`) e o tamanho em disco.

import { mkdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { dedup, getBounds, prune, quantize, textureCompress, weld } from '@gltf-transform/functions'
import sharp from 'sharp'

const FRONTEND_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sourceDir = resolve(process.argv[2] ?? resolve(FRONTEND_DIR, '../assets/source/sketchfab'))
const outDir = resolve(process.argv[3] ?? resolve(FRONTEND_DIR, 'public/models'))

/** `scale`: fator até metros; `rotateYDeg`: giro para o comprimento ficar em Z; `keep`: filtro de nós. */
const CARGO_MODELS = [
  { id: 'caixa-madeira', src: 'cargas/carga-caixa-madeira.glb', scale: 1, maxTexture: 1024 },
  { id: 'conteiner', src: 'cargas/carga-conteiner.glb', scale: 1, maxTexture: 1024 },
  {
    id: 'feixe-tubos',
    src: 'cargas/carga-feixe-tubos.glb',
    scale: 1,
    rotateYDeg: 90,
    maxTexture: 1024,
  },
  {
    id: 'gerador-diesel',
    src: 'cargas/carga-gerador-diesel.glb',
    scale: 1,
    rotateYDeg: 90,
    maxTexture: 1024,
  },
  { id: 'transformador', src: 'cargas/carga-transformador.glb', scale: 1, maxTexture: 1024 },
  {
    id: 'viga-concreto-canal',
    src: 'cargas/carga-viga-concreto-canal.glb',
    scale: 1,
    keepOnly: { pattern: /^Beam(\.\d+)?$/, name: 'Beam.008' },
    maxTexture: 1024,
  },
  {
    id: 'viga-concreto-tubgirder',
    src: 'cargas/carga-viga-concreto-tubgirder.glb',
    scale: 1,
    keepOnly: { pattern: /^Beam(\.\d+)?$/, name: 'Beam.005' },
    maxTexture: 1024,
  },
]

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)

function round(value) {
  return Math.round(value * 100) / 100
}

function sizeOf(bounds) {
  return {
    w: round(bounds.max[0] - bounds.min[0]),
    h: round(bounds.max[1] - bounds.min[1]),
    d: round(bounds.max[2] - bounds.min[2]),
  }
}

/** Coloca o conteúdo da cena num nó "objeto" com giro, escala e deslocamento (base em y = 0). */
function wrapScene(doc, { scale, rotateYDeg = 0, baseY, centerX, centerZ }) {
  const scene = doc.getRoot().listScenes()[0]
  const half = (rotateYDeg * Math.PI) / 360
  const wrapper = doc.createNode('objeto').setRotation([0, Math.sin(half), 0, Math.cos(half)])
  for (const child of scene.listChildren()) {
    scene.removeChild(child)
    wrapper.addChild(child)
  }
  scene.addChild(wrapper)
  // Mede já com o giro, para centrar e assentar a base depois dele.
  wrapper.setScale([scale, scale, scale])
  const bounds = getBounds(scene)
  const cx = centerX === undefined ? (bounds.min[0] + bounds.max[0]) / 2 : centerX * scale
  const cz = centerZ === undefined ? (bounds.min[2] + bounds.max[2]) / 2 : centerZ * scale
  const by = baseY === undefined ? bounds.min[1] : baseY * scale
  wrapper.setTranslation([-cx, -by, -cz])
}

async function finish(doc, id, subdir, maxTexture) {
  await doc.transform(
    prune(),
    dedup(),
    textureCompress({
      encoder: sharp,
      targetFormat: 'webp',
      resize: [maxTexture, maxTexture],
      quality: 80,
    }),
    weld(),
    quantize(),
    prune(),
  )
  const scene = doc.getRoot().listScenes()[0]
  const size = sizeOf(getBounds(scene))
  const dir = resolve(outDir, subdir)
  mkdirSync(dir, { recursive: true })
  const bytes = await io.writeBinary(doc)
  const file = resolve(dir, `${id}.glb`)
  writeFileSync(file, bytes)
  return { id: `${subdir}/${id}`, size, bytes: statSync(file).size }
}

/** Mantém só uma das peças de um conjunto (as outras vigas do arquivo ficam de fora). */
function keepOnly(doc, { pattern, name }) {
  for (const node of doc.getRoot().listNodes()) {
    if (pattern.test(node.getName()) && node.getName() !== name) node.dispose()
  }
}

async function convertCargo(model) {
  const doc = await io.read(resolve(sourceDir, model.src))
  if (model.keepOnly) keepOnly(doc, model.keepOnly)
  wrapScene(doc, model)
  return finish(doc, model.id, 'cargas', model.maxTexture)
}

// ---------------------------------------------------------------------------------------------
// Galpão (hangar de nermin, em cm). Frente em +Z; origem no centro da planta, base em y = 0 (m).
// ---------------------------------------------------------------------------------------------

/** Tira os triângulos de uma malha cujos vértices todos satisfazem `drop`. */
function dropTriangles(mesh, drop) {
  let removed = 0
  for (const primitive of mesh.listPrimitives()) {
    const position = primitive.getAttribute('POSITION')
    const indices = primitive.getIndices()
    const next = []
    const total = indices.getCount()
    for (let t = 0; t < total; t += 3) {
      const ids = [0, 1, 2].map((k) => indices.getScalar(t + k))
      const points = ids.map((id) => position.getElement(id, []))
      if (points.every(drop)) removed += 1
      else next.push(...ids)
    }
    indices.setArray(new Uint32Array(next))
  }
  return removed
}

async function buildHangar() {
  const doc = await io.read(resolve(sourceDir, 'galpoes/galpao-hangar.glb'))
  const meshes = new Map(
    doc
      .getRoot()
      .listMeshes()
      .map((mesh) => [mesh.getName(), mesh]),
  )
  // O pano da frente (com o portão e as janelas pintados) e o toldo ficam de fora: a frente abre. A malha
  // "trim" está girada 180° em Y no arquivo, então o toldo da frente (+Z) é o do lado -Z dela.
  const cap = dropTriangles(meshes.get('main_main_0'), (p) => p[2] >= 1140)
  const awning = dropTriangles(meshes.get('trim_metaltrim_0'), (p) => p[2] <= -1100)
  console.log(`hangar: ${cap} triângulos do pano da frente e ${awning} do toldo removidos`)
  // Lâmpadas, caixa de luz e barril de dentro e de fora ficam de fora: soltos, só atrapalham a carga.
  const props = new Set(['ceilinglamp', 'Walllamp', 'electricbox1', 'barrel'])
  for (const node of doc.getRoot().listNodes()) {
    if (props.has(node.getName())) node.dispose()
  }
  // O arquivo está em cm; a base é o pé da calçada (y = 20), a planta é centrada no corpo do hangar.
  wrapScene(doc, { scale: 0.01, baseY: 20, centerX: 0, centerZ: 2.4 })
  return finish(doc, 'barracao-aberto', 'objetos', 1024)
}

const results = []
results.push(await buildHangar())
for (const model of CARGO_MODELS) results.push(await convertCargo(model))

for (const r of results) {
  console.log(
    `${r.id.padEnd(34)} ${String(r.size.w).padStart(6)} x ${String(r.size.d).padStart(6)} x ${String(r.size.h).padStart(6)} m (w x d x h)  ${(r.bytes / 1024).toFixed(0)} KB`,
  )
}
