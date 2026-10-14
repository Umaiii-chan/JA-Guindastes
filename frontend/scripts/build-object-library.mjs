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
// O galpão com a frente aberta (`barracao-aberto.glb`) não vem dos kits (os galpões da Kenney são
// maciços, com portão só pintado): é o hangar de nermin (CC BY 4.0), gerado por
// `scripts/build-sketchfab-models.mjs`. Antes (TASK-072) ele era desenhado por código aqui.
//
// No fim o script imprime as medidas finais (`baseSize`) de cada arquivo, que vão para a biblioteca.

import { mkdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { NodeIO } from '@gltf-transform/core'
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

mkdirSync(outDir, { recursive: true })
const results = []
for (const model of KENNEY_MODELS) results.push(await convertKenney(model))

for (const r of results) {
  console.log(
    `${r.id.padEnd(22)} ${String(r.size.w).padStart(6)} x ${String(r.size.d).padStart(6)} x ${String(r.size.h).padStart(6)} m (w x d x h)  ${(r.bytes / 1024).toFixed(0)} KB`,
  )
}
