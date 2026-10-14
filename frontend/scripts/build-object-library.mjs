// Gera os GLBs da biblioteca de objetos do editor 3D do ambiente (TASK-072; ADR-036).
//
// Rodar, em frontend/:
//
//   node scripts/build-object-library.mjs [pasta-dos-kits-kenney] [pasta-de-saida]
//
// Padrões: entrada `../assets/source/kenney` (fora do Git, ver .gitignore; os kits `car-kit`,
// `suburban`, `industrial` e `nature`, todos CC0 da Kenney, https://kenney.nl) e saída
// `public/models/objetos`. A saída é determinística.
//
// O que o script faz com cada modelo da Kenney:
//
//  1. lê o GLB (a textura de paleta vem embutida na saída);
//  2. põe a base em y = 0 e o centro da planta em (0, 0), e aplica uma escala única que leva o modelo
//     ao tamanho real em metros (os kits vêm em escala de brinquedo). A escala vira um nó-raiz
//     "objeto", então o arquivo continua sendo o original, só com um nó a mais;
//  3. solda vértices, tira o que sobra e quantiza (KHR_mesh_quantization, que o GLTFLoader lê sem
//     decodificador).
//
// O barracão aberto não existe nos kits (os galpões da Kenney são maciços, com portão só pintado):
// é gerado aqui por código, com paredes, porta, piso e telhado de duas águas translúcido. As
// caixas de colisão dele estão em `src/domain/environment/objectLibrary.ts` e seguem as mesmas
// medidas deste arquivo (um teste confere os dois).
//
// No fim o script imprime as medidas finais (`baseSize`) de cada arquivo, que vão para a biblioteca.

import { mkdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { Document, NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { dedup, getBounds, prune, quantize, weld } from '@gltf-transform/functions'

const FRONTEND_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sourceDir = resolve(process.argv[2] ?? resolve(FRONTEND_DIR, '../assets/source/kenney'))
const outDir = resolve(process.argv[3] ?? resolve(FRONTEND_DIR, 'public/models/objetos'))

const NATURE = 'nature/Models/GLTF format'
const SUBURBAN = 'suburban/Models/GLB format'
const INDUSTRIAL = 'industrial/Models/GLB format'
const CAR_KIT = 'car-kit/Models/GLB format'

/**
 * Modelos da Kenney: `scale` é o fator único até o tamanho real (m). Os tamanhos de referência são
 * os do pedido: árvore de 6 a 10 m, casa de ~7 m, galpão de 8 a 10 m, caminhão de ~8 m, carro de
 * ~4,5 m.
 */
const KENNEY_MODELS = [
  { id: 'arvore-carvalho', src: `${NATURE}/tree_oak.glb`, scale: 6.5 },
  { id: 'pinheiro', src: `${NATURE}/tree_pineDefaultA.glb`, scale: 5.8 },
  { id: 'arvore-copa-redonda', src: `${NATURE}/tree_default.glb`, scale: 4.5 },
  { id: 'palmeira', src: `${NATURE}/tree_palmTall.glb`, scale: 6.5 },
  { id: 'moita-grande', src: `${NATURE}/plant_bushLarge.glb`, scale: 7.5 },
  { id: 'moita', src: `${NATURE}/plant_bush.glb`, scale: 5 },
  { id: 'casa-terrea', src: `${SUBURBAN}/building-type-a.glb`, scale: 5.4 },
  { id: 'casa-sobrado', src: `${SUBURBAN}/building-type-d.glb`, scale: 4.6 },
  { id: 'galpao-fechado', src: `${INDUSTRIAL}/building-i.glb`, scale: 11.5 },
  { id: 'conteiner', src: `${INDUSTRIAL}/shipping-container-a.glb`, scale: 7.3 },
  { id: 'caminhao', src: `${CAR_KIT}/truck.glb`, scale: 2.7 },
  { id: 'caminhao-plataforma', src: `${CAR_KIT}/truck-flat.glb`, scale: 2.7 },
  { id: 'caminhao-bau', src: `${CAR_KIT}/delivery.glb`, scale: 2.4 },
  { id: 'sedan', src: `${CAR_KIT}/sedan.glb`, scale: 1.75 },
  { id: 'suv', src: `${CAR_KIT}/suv.glb`, scale: 1.7 },
  { id: 'van', src: `${CAR_KIT}/van.glb`, scale: 1.9 },
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

async function finish(doc, id) {
  await doc.transform(weld(), dedup(), prune(), quantize())
  const scene = doc.getRoot().listScenes()[0]
  const size = sizeOf(getBounds(scene))
  const bytes = await io.writeBinary(doc)
  const file = resolve(outDir, `${id}.glb`)
  writeFileSync(file, bytes)
  return { id, file: `${id}.glb`, size, bytes: statSync(file).size }
}

async function convertKenney(model) {
  const doc = await io.read(resolve(sourceDir, model.src))
  const scene = doc.getRoot().listScenes()[0]
  const bounds = getBounds(scene)
  const s = model.scale
  const wrapper = doc
    .createNode('objeto')
    .setScale([s, s, s])
    .setTranslation([
      (-(bounds.min[0] + bounds.max[0]) / 2) * s,
      -bounds.min[1] * s,
      (-(bounds.min[2] + bounds.max[2]) / 2) * s,
    ])
  for (const child of scene.listChildren()) {
    scene.removeChild(child)
    wrapper.addChild(child)
  }
  scene.addChild(wrapper)
  return finish(doc, model.id)
}

// ---------------------------------------------------------------------------------------------
// Barracão aberto (gerado). Frente em +Z; origem no centro da planta, base em y = 0 (m).
// ---------------------------------------------------------------------------------------------
const SHED = {
  width: 14, // x
  depth: 18, // z
  wall: 0.4, // espessura das paredes
  wallHeight: 7, // altura do beiral
  ridgeHeight: 8.8, // altura da cumeeira
  doorWidth: 8,
  doorHeight: 6,
  slab: 0.6, // espessura do telhado sobre o beiral (caixa de colisão)
}

class MeshBuilder {
  constructor() {
    this.positions = []
    this.normals = []
    this.indices = []
  }

  /** Quadrilátero a, b, c, d em sentido anti-horário visto de fora. */
  quad(a, b, c, d) {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
    const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
    let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
    const len = Math.hypot(...n) || 1
    n = n.map((x) => x / len)
    const base = this.positions.length / 3
    for (const p of [a, b, c, d]) {
      this.positions.push(...p)
      this.normals.push(...n)
    }
    this.indices.push(base, base + 1, base + 2, base, base + 2, base + 3)
  }

  triangle(a, b, c) {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
    const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
    let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
    const len = Math.hypot(...n) || 1
    n = n.map((x) => x / len)
    const base = this.positions.length / 3
    for (const p of [a, b, c]) {
      this.positions.push(...p)
      this.normals.push(...n)
    }
    this.indices.push(base, base + 1, base + 2)
  }

  /** Caixa de (x0, y0, z0) a (x1, y1, z1). */
  box(x0, y0, z0, x1, y1, z1) {
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]) // +Z
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]) // -Z
    this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]) // +X
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]) // -X
    this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]) // +Y
    this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]) // -Y
  }
}

function buildShed() {
  const { width, depth, wall, wallHeight, ridgeHeight, doorWidth, doorHeight } = SHED
  const hx = width / 2
  const hz = depth / 2
  const hd = doorWidth / 2

  const walls = new MeshBuilder()
  walls.box(-hx, 0, -hz, hx, wallHeight, -hz + wall) // fundo
  walls.box(-hx, 0, -hz + wall, -hx + wall, wallHeight, hz) // lateral esquerda
  walls.box(hx - wall, 0, -hz + wall, hx, wallHeight, hz) // lateral direita
  walls.box(-hx + wall, 0, hz - wall, -hd, wallHeight, hz) // pilar esquerdo da frente
  walls.box(hd, 0, hz - wall, hx - wall, wallHeight, hz) // pilar direito da frente
  // Empena (triângulo sob a cumeeira) na frente e no fundo.
  walls.triangle([-hx, wallHeight, hz], [hx, wallHeight, hz], [0, ridgeHeight, hz])
  walls.triangle([hx, wallHeight, -hz], [-hx, wallHeight, -hz], [0, ridgeHeight, -hz])

  const frame = new MeshBuilder()
  frame.box(-hd, doorHeight, hz - wall, hd, wallHeight, hz) // verga sobre a porta
  frame.box(-hd - 0.25, 0, hz - wall - 0.05, -hd, doorHeight, hz) // batente esquerdo
  frame.box(hd, 0, hz - wall - 0.05, hd + 0.25, doorHeight, hz) // batente direito

  const floor = new MeshBuilder()
  floor.box(-hx + wall, 0, -hz + wall, hx - wall, 0.08, hz)

  const roof = new MeshBuilder()
  const overhang = 0
  const x = hx + overhang
  const z0 = -hz - overhang
  const z1 = hz + overhang
  roof.quad([-x, wallHeight, z1], [0, ridgeHeight, z1], [0, ridgeHeight, z0], [-x, wallHeight, z0])
  roof.quad([0, ridgeHeight, z1], [x, wallHeight, z1], [x, wallHeight, z0], [0, ridgeHeight, z0])

  const doc = new Document()
  const buffer = doc.createBuffer()
  const mesh = doc.createMesh('barracao')
  const material = (name, color, extra = {}) => {
    const m = doc
      .createMaterial(name)
      .setBaseColorFactor(color)
      .setRoughnessFactor(0.9)
      .setMetallicFactor(0)
      .setDoubleSided(extra.doubleSided ?? false)
    if (extra.alpha) m.setAlphaMode('BLEND')
    return m
  }
  const parts = [
    [walls, material('parede', [0.62, 0.66, 0.78, 1])],
    [frame, material('batente', [0.91, 0.64, 0.24, 1])],
    [floor, material('piso', [0.55, 0.56, 0.6, 1])],
    [roof, material('telhado', [0.27, 0.3, 0.45, 0.55], { doubleSided: true, alpha: true })],
  ]
  for (const [builder, mat] of parts) {
    const primitive = doc
      .createPrimitive()
      .setAttribute(
        'POSITION',
        doc
          .createAccessor()
          .setType('VEC3')
          .setArray(new Float32Array(builder.positions))
          .setBuffer(buffer),
      )
      .setAttribute(
        'NORMAL',
        doc
          .createAccessor()
          .setType('VEC3')
          .setArray(new Float32Array(builder.normals))
          .setBuffer(buffer),
      )
      .setIndices(
        doc
          .createAccessor()
          .setType('SCALAR')
          .setArray(new Uint16Array(builder.indices))
          .setBuffer(buffer),
      )
      .setMaterial(mat)
    mesh.addPrimitive(primitive)
  }
  const node = doc.createNode('objeto').setMesh(mesh)
  doc.createScene('cena').addChild(node)
  return doc
}

mkdirSync(outDir, { recursive: true })
const results = []
for (const model of KENNEY_MODELS) results.push(await convertKenney(model))
results.push(await finish(buildShed(), 'barracao-aberto'))

for (const r of results) {
  console.log(
    `${r.id.padEnd(22)} ${String(r.size.w).padStart(6)} x ${String(r.size.d).padStart(6)} x ${String(r.size.h).padStart(6)} m (w x d x h)  ${(r.bytes / 1024).toFixed(0)} KB`,
  )
}
