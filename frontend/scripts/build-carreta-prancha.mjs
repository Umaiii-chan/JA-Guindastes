// Gera o GLB da carreta prancha da biblioteca de objetos do editor 3D (TASK-108; ADR-052).
//
// Rodar, em frontend/:
//
//   node scripts/build-carreta-prancha.mjs [pasta-de-saida]
//
// Padrão de saída: `public/models/objetos`. Diferente dos demais objetos da biblioteca, este não vem de
// um kit de terceiros: é desenhado aqui, por código (caixas e cilindros), sem textura, e por isso é
// trabalho do próprio projeto (sem licença de terceiros). A saída é determinística.
//
// O modelo é um semirreboque plano de 3 eixos, em metros, com a base em y = 0, o centro da planta na
// origem e a frente (o pino-rei, que engata no cavalo mecânico) em +Z. As medidas são típicas e
// FICTÍCIAS, não de um fabricante: convés de 2,6 m x 13 m a 1,5 m do chão (`FLATBED_TRAILER` em
// `src/domain/environment/objectLibrary.ts`; um teste confere o tamanho do arquivo).

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { Document, NodeIO } from '@gltf-transform/core'

const FRONTEND_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = resolve(process.argv[2] ?? resolve(FRONTEND_DIR, 'public/models/objetos'))

const WIDTH = 2.6
const LENGTH = 13
const DECK_TOP = 1.5
const DECK_THICKNESS = 0.2

/** Geometria acumulada por material: posições, normais e índices. */
const parts = new Map()

function part(material) {
  if (!parts.has(material)) parts.set(material, { positions: [], normals: [], indices: [] })
  return parts.get(material)
}

/** Caixa alinhada aos eixos, com faces planas. */
function box(material, [x0, x1], [y0, y1], [z0, z1]) {
  const target = part(material)
  const faces = [
    // normal, quatro cantos em ordem anti-horária vistos de fora
    [
      [1, 0, 0],
      [
        [x1, y0, z0],
        [x1, y1, z0],
        [x1, y1, z1],
        [x1, y0, z1],
      ],
    ],
    [
      [-1, 0, 0],
      [
        [x0, y0, z1],
        [x0, y1, z1],
        [x0, y1, z0],
        [x0, y0, z0],
      ],
    ],
    [
      [0, 1, 0],
      [
        [x0, y1, z0],
        [x0, y1, z1],
        [x1, y1, z1],
        [x1, y1, z0],
      ],
    ],
    [
      [0, -1, 0],
      [
        [x0, y0, z1],
        [x0, y0, z0],
        [x1, y0, z0],
        [x1, y0, z1],
      ],
    ],
    [
      [0, 0, 1],
      [
        [x1, y0, z1],
        [x1, y1, z1],
        [x0, y1, z1],
        [x0, y0, z1],
      ],
    ],
    [
      [0, 0, -1],
      [
        [x0, y0, z0],
        [x0, y1, z0],
        [x1, y1, z0],
        [x1, y0, z0],
      ],
    ],
  ]
  for (const [normal, corners] of faces) {
    const base = target.positions.length / 3
    for (const corner of corners) {
      target.positions.push(...corner)
      target.normals.push(...normal)
    }
    target.indices.push(base, base + 1, base + 2, base, base + 2, base + 3)
  }
}

/** Cilindro com o eixo ao longo de X (roda), centro em (`cy`, `cz`). */
function wheel(material, [x0, x1], cy, cz, radius, segments = 16) {
  const target = part(material)
  for (let index = 0; index < segments; index += 1) {
    const a0 = (index / segments) * Math.PI * 2
    const a1 = ((index + 1) / segments) * Math.PI * 2
    const mid = (a0 + a1) / 2
    const ring = (angle) => [cy + Math.sin(angle) * radius, cz + Math.cos(angle) * radius]
    const [ya, za] = ring(a0)
    const [yb, zb] = ring(a1)
    const base = target.positions.length / 3
    target.positions.push(x0, ya, za, x1, ya, za, x1, yb, zb, x0, yb, zb)
    for (let corner = 0; corner < 4; corner += 1)
      target.normals.push(0, Math.sin(mid), Math.cos(mid))
    target.indices.push(base, base + 1, base + 2, base, base + 2, base + 3)
    for (const [x, side] of [
      [x1, 1],
      [x0, -1],
    ]) {
      const cap = target.positions.length / 3
      target.positions.push(x, cy, cz, x, ya, za, x, yb, zb)
      for (let corner = 0; corner < 3; corner += 1) target.normals.push(side, 0, 0)
      // anti-horário visto de fora: a tampa de +X é vista de +X, onde o anel (y = sen, z = cos) gira no sentido horário
      target.indices.push(...(side === 1 ? [cap, cap + 2, cap + 1] : [cap, cap + 1, cap + 2]))
    }
  }
}

const half = WIDTH / 2
const zRear = -LENGTH / 2
const zFront = LENGTH / 2

// Convés (o apoio da carga), de 2,6 m x 13 m, com o topo a 1,5 m.
box('convés', [-half, half], [DECK_TOP - DECK_THICKNESS, DECK_TOP], [zRear, zFront])
// Chassi: duas longarinas sob o convés e a placa do pino-rei na frente.
for (const side of [-1, 1]) {
  box(
    'chassi',
    [side * 0.4 - 0.075, side * 0.4 + 0.075],
    [1.0, DECK_TOP - DECK_THICKNESS],
    [zRear + 0.2, zFront - 1.4],
  )
}
box('chassi', [-0.5, 0.5], [1.15, DECK_TOP - DECK_THICKNESS], [zFront - 1.9, zFront - 0.2])
box('chassi', [-0.08, 0.08], [1.05, 1.15], [zFront - 0.95, zFront - 0.79])
box('chassi', [-1.2, 1.2], [1.05, 1.25], [zRear, zRear + 0.12])
// Pés de apoio (engate solto): duas colunas até o chão, atrás do pino-rei.
for (const side of [-1, 1]) {
  box('chassi', [side * 0.9 - 0.08, side * 0.9 + 0.08], [0, 1.15], [zFront - 3.0, zFront - 2.85])
}
// Três eixos de rodas duplas, atrás.
for (const axleZ of [-4.6, -3.4, -2.2]) {
  box('chassi', [-1.25, 1.25], [0.46, 0.54], [axleZ - 0.06, axleZ + 0.06])
  for (const side of [-1, 1]) {
    wheel(
      'pneu',
      [side * 0.99, side * 1.27].sort((a, b) => a - b),
      0.5,
      axleZ,
      0.5,
    )
    wheel(
      'pneu',
      [side * 0.67, side * 0.95].sort((a, b) => a - b),
      0.5,
      axleZ,
      0.5,
    )
  }
}

const COLORS = {
  convés: [0.36, 0.4, 0.45, 1],
  chassi: [0.12, 0.13, 0.15, 1],
  pneu: [0.06, 0.06, 0.07, 1],
}

const doc = new Document()
const buffer = doc.createBuffer()
const mesh = doc.createMesh('carreta-prancha')
for (const [name, data] of parts) {
  const material = doc
    .createMaterial(name)
    .setBaseColorFactor(COLORS[name])
    .setMetallicFactor(0)
    .setRoughnessFactor(0.85)
  const primitive = doc
    .createPrimitive()
    .setMaterial(material)
    .setAttribute(
      'POSITION',
      doc
        .createAccessor()
        .setType('VEC3')
        .setArray(new Float32Array(data.positions))
        .setBuffer(buffer),
    )
    .setAttribute(
      'NORMAL',
      doc
        .createAccessor()
        .setType('VEC3')
        .setArray(new Float32Array(data.normals))
        .setBuffer(buffer),
    )
    .setIndices(
      doc
        .createAccessor()
        .setType('SCALAR')
        .setArray(new Uint16Array(data.indices))
        .setBuffer(buffer),
    )
  mesh.addPrimitive(primitive)
}
const node = doc.createNode('carreta-prancha').setMesh(mesh)
doc.createScene('carreta-prancha').addChild(node)

mkdirSync(outDir, { recursive: true })
const file = resolve(outDir, 'carreta-prancha.glb')
const binary = await new NodeIO().writeBinary(doc)
writeFileSync(file, binary)
console.log(`${file}: ${binary.byteLength} bytes`)
